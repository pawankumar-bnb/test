import { create } from 'zustand'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ConfirmRequest {
  title: string
  description: string
  confirmLabel: string
}

const useConfirmStore = create<{
  request: ConfirmRequest | null
  resolve: ((ok: boolean) => void) | null
}>(() => ({ request: null, resolve: null }))

/** Promise-based confirmation, for actions an undo toast cannot take back. */
export function confirmAction(request: ConfirmRequest) {
  return new Promise<boolean>((resolve) => {
    useConfirmStore.setState({ request, resolve })
  })
}

export function ConfirmHost() {
  const { request, resolve } = useConfirmStore()

  function close(result: boolean) {
    resolve?.(result)
    useConfirmStore.setState({ request: null, resolve: null })
  }

  return (
    <AlertDialog open={Boolean(request)} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => close(true)}>
            {request?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
