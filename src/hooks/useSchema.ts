import useSWR from 'swr'
import { useAuth } from '@/app/auth-provider'
import { JSONSchema } from '@/types/contact-schema'

export function useSchema(formId: string) {
  const { customerId } = useAuth()
  
  // Remove 'get-' prefix if present
  const cleanFormId = formId.startsWith('get-') ? formId.replace('get-', '') : formId
  
  // Only fetch if we have both a formId and customerId
  const shouldFetch = cleanFormId && customerId
  
  const { data, error, isLoading } = useSWR(
    shouldFetch ? `/api/schema/${cleanFormId}/${customerId}` : null,
    async (url) => {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch schema')
      }
      return response.json()
    }
  )

  return {
    schema: data?.schema,
    isLoading,
    error
  }
} 