import { useCallback, useEffect, useRef, useState } from 'react'

/** 防抖搜索 + 分页列表（沿用 test1 的 useList 模式） */
export function useList<T>(
  fetcher: (params: { keyword: string; page: number; limit: number }) => Promise<{ total: number; items: T[] }>,
  deps: unknown[] = [],
  limit = 50,
) {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const [debounced, setDebounced] = useState('')
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current && keyword === '') {
      firstRender.current = false
      setDebounced('')
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebounced(keyword)
      setPage(1)
    }, 300)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetcher({ keyword: debounced, page, limit })
      setItems(data.items)
      setTotal(data.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, page, ...deps])

  useEffect(() => {
    load()
  }, [load])

  return { keyword, setKeyword, page, setPage, items, total, loading, error, reload: load }
}
