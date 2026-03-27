import { RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/ui'

interface RefreshButtonProps {
    isFetching: boolean
    refetch: () => void
}

export function RefreshButton({ isFetching, refetch }: RefreshButtonProps) {
    return (
        <Button size="lg" type="button" variant="outline" disabled={isFetching} onClick={refetch}>
            <RefreshCwIcon className={cn(isFetching && 'animate-spin')} />
            Refresh
        </Button>
    )
}
