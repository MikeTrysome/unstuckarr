import { useEffect, useRef, useState } from 'react'
import { getToken } from '../lib/auth'
import type { LogMessage } from '../types'

export function useWebSocket(path: string, maxMessages = 200) {
  const [messages, setMessages] = useState<LogMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true

    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const token = getToken()
      const sep = path.includes('?') ? '&' : '?'
      const url = `${proto}://${window.location.host}${path}${token ? `${sep}token=${token}` : ''}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => { if (active) setConnected(true) }

      ws.onmessage = (ev) => {
        if (!active) return
        try {
          const msg: LogMessage = JSON.parse(ev.data)
          if (msg.type === 'ping') return
          setMessages((prev) => {
            const next = [...prev, msg]
            return next.length > maxMessages ? next.slice(-maxMessages) : next
          })
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        if (!active) return
        setConnected(false)
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      active = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [path, maxMessages])

  const clear = () => setMessages([])

  return { messages, connected, clear }
}
