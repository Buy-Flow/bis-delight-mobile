import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/evolution-diag')({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.EVOLUTION_API_URL
        const key = process.env.EVOLUTION_API_KEY
        const out: any = { hasUrl: !!url, hasKey: !!key, url }
        try {
          const ctrl = new AbortController()
          const t = setTimeout(() => ctrl.abort(), 12000)
          const r = await fetch(`${url}/instance/fetchInstances`, {
            headers: { apikey: key || '' },
            signal: ctrl.signal,
          })
          clearTimeout(t)
          out.status = r.status
          out.body = (await r.text()).slice(0, 500)
        } catch (e: any) {
          out.error = String(e?.message || e)
        }
        return Response.json(out)
      },
    },
  },
})
