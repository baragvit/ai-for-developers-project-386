import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, bookingApi, type CreateBookingRequest, type EventType } from './client'

declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        failureCount < 2 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500),
    },
  },
})

const keys = {
  owner: ['owner'] as const,
  eventTypes: ['event-types'] as const,
  eventType: (id: string) => ['event-types', id] as const,
  slots: (id: string) => ['event-types', id, 'slots'] as const,
  upcomingBookings: ['admin', 'bookings'] as const,
}

export const useOwner = () => useQuery({ queryKey: keys.owner, queryFn: bookingApi.getOwner })

export const useEventTypes = () =>
  useQuery({ queryKey: keys.eventTypes, queryFn: bookingApi.listEventTypes })

export const useEventType = (id: string) =>
  useQuery({ queryKey: keys.eventType(id), queryFn: () => bookingApi.getEventType(id) })

export const useSlots = (eventTypeId: string) =>
  useQuery({ queryKey: keys.slots(eventTypeId), queryFn: () => bookingApi.listSlots(eventTypeId) })

export const useUpcomingBookings = () =>
  useQuery({ queryKey: keys.upcomingBookings, queryFn: bookingApi.listUpcomingBookings })

/** Any booking change makes slots of every event type stale, because bookings block time across types. */
function invalidateBookingData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.eventTypes }),
    queryClient.invalidateQueries({ queryKey: keys.upcomingBookings }),
  ])
}

export const useCreateBooking = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: CreateBookingRequest) => bookingApi.createBooking(request),
    onSettled: () => invalidateBookingData(client),
  })
}

export const useCreateEventType = () => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (eventType: EventType) => bookingApi.createEventType(eventType),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.eventTypes }),
  })
}
