import { cn } from '@/lib/ui'

export function PageHeader({
    title,
    description,
    actions,
    className,
    ...props
}: React.ComponentProps<'section'> & {
    title: string
    description?: string
    actions?: React.ReactNode
}) {
    return (
        <section
            className={cn('flex items-end justify-between gap-4 border-b px-6 py-4', className)}
            {...props}
        >
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                {description ? <p className="text-muted-foreground">{description}</p> : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
        </section>
    )
}
