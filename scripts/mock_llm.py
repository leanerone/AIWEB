"""本地 Mock LLM：模拟 OpenAI 兼容接口，用于不依赖真实 Key 的端到端联调。

用法：python scripts/mock_llm.py  （监听 127.0.0.1:9377）
backend/.env 配：
    AI_API_BASE=http://127.0.0.1:9377/v1
    AI_API_KEY=sk-mock-local
    AI_MODEL=mock-mini

脚本化行为（无状态，按消息序列推断）：
- 消息里没有工具结果 → 发起一次工具调用：
    用户消息含「记/笔记」 → create_memo；否则 → search_platform（query=用户消息前 12 字）
- 已有工具结果 → 直接给最终回答（引用工具结果数量）
- 无 tools 参数（ReAct 模式） → 输出 JSON 动作协议
"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse


def make_response(content=None, tool_calls=None):
    msg = {"role": "assistant", "content": content}
    if tool_calls:
        msg["tool_calls"] = tool_calls
        msg["content"] = None
    return {"id": "mock", "object": "chat.completion", "created": 0, "model": "mock-mini",
            "choices": [{"index": 0, "message": msg, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}}


def scripted_reply(body: dict) -> dict:
    messages = body.get("messages", [])
    tools = body.get("tools")
    system_text = next((m.get("content", "") for m in messages if m.get("role") == "system"), "")
    if "起一个不超过12字的中文标题" in system_text:
        last_user = next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "对话")
        title = (last_user.replace("问：", "").split(chr(10))[0] or "新对话")[:12]
        return make_response(content=title)
    react_mode = not tools
    last_user = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
    tool_results = [m for m in messages if m.get("role") == "tool" or m.get("tool_call_id")]
    if tool_results:
        joined = " ".join(str(m.get("content", "")) for m in tool_results)
        if "用户回答：" in joined:
            answer = f"收到你的选择（{joined.split('用户回答：')[-1].strip()}）。这是对应的 Mock 推荐结果。"
            if react_mode:
                return make_response(json.dumps({"action": "final", "answer": answer}, ensure_ascii=False))
            return make_response(content=answer)
        answer = f"我已经查证过了（{len(tool_results)} 次工具调用）。平台内容的要点如下：\n- 这是一条 Mock 演示回答\n- 工具结果已注入上下文\n\n如需更详细的信息可以继续问我。"
        if react_mode:
            return make_response(json.dumps({"action": "final", "answer": answer}, ensure_ascii=False))
        return make_response(content=answer)

    if "推荐" in last_user or "选" in last_user:
        args = {"question": "你想要哪个方向的推荐？", "options": ["代码助手", "资讯简报"]}
        if react_mode:
            return make_response(json.dumps({"action": "ask_user", "args": args}, ensure_ascii=False))
        return make_response(tool_calls=[{"id": "mock_call_ask", "type": "function",
                                          "function": {"name": "ask_user", "arguments": json.dumps(args, ensure_ascii=False)}}])

    if "记" in last_user or "笔记" in last_user:
        title = last_user[:16] or "Mock 笔记"
        args = {"title": title, "content": f"由 Mock Agent 为你创建：\n\n{last_user}", "tags": ["mock"]}
        if react_mode:
            return make_response(json.dumps({"action": "create_memo", "args": args}, ensure_ascii=False))
        return make_response(tool_calls=[{"id": "mock_call_1", "type": "function",
                                          "function": {"name": "create_memo", "arguments": json.dumps(args, ensure_ascii=False)}}])

    query = last_user[:12] or "AI"
    if react_mode:
        return make_response(json.dumps({"action": "search_platform", "args": {"query": query}}, ensure_ascii=False))
    return make_response(tool_calls=[{"id": "mock_call_1", "type": "function",
                                      "function": {"name": "search_platform", "arguments": json.dumps({"query": query}, ensure_ascii=False)}}])


def sse_stream(body: dict) -> bytes:
    """把 scripted_reply 的结果转成 OpenAI 流式 SSE：content 分片、tool_calls 一次成型"""
    reply = scripted_reply(body)
    msg = reply["choices"][0]["message"]
    out = []

    def send(delta: dict):
        out.append("data: " + json.dumps(
            {"id": "mock", "object": "chat.completion.chunk", "model": "mock-mini",
             "choices": [{"index": 0, "delta": delta, "finish_reason": None}]},
            ensure_ascii=False) + "\n\n")

    send({"role": "assistant"})
    if msg.get("tool_calls"):
        for tc in msg["tool_calls"]:
            fn = tc["function"]
            # 分两片模拟增量参数流
            half = max(1, len(fn["arguments"]) // 2)
            send({"tool_calls": [{"index": 0, "id": tc["id"], "type": "function",
                                  "function": {"name": fn["name"], "arguments": fn["arguments"][:half]}}]})
            send({"tool_calls": [{"index": 0, "function": {"arguments": fn["arguments"][half:]}}]})
    else:
        content = msg.get("content") or ""
        for i in range(0, len(content), 6):
            send({"content": content[i:i + 6]})
    send({})  # 收尾空 delta
    out.append("data: [DONE]\n\n")
    return "".join(out).encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # 安静模式
        pass

    def do_GET(self):
        if urlparse(self.path).path.endswith("/models"):
            data = json.dumps({"data": [{"id": "mock-mini"}]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            body = {}
        if body.get("stream"):
            # 逐块写出 + 微延迟，让前端真流式可见（真实 LLM 天然逐 token）
            import time as _time

            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            for piece in sse_stream(body).split(b"\n\n"):
                self.wfile.write(piece + b"\n\n")
                self.wfile.flush()
                _time.sleep(0.03)
            return
        data = json.dumps(scripted_reply(body), ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    print("Mock LLM listening on http://127.0.0.1:9377/v1")
    HTTPServer(("127.0.0.1", 9377), Handler).serve_forever()
