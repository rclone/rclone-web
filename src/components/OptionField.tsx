import { useId, useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    FieldTitle,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export type OptionFieldOption = {
    Name: string
    Help?: string | null
    Type?: string | null
    IsPassword?: boolean
    Required?: boolean
    Hide?: number
    DefaultStr?: string | null
    Examples?: Array<{ Value?: string; Help?: string }> | null
}

export function normalizeBoolean(value: unknown) {
    if (typeof value === 'boolean') {
        return value
    }

    if (typeof value === 'number') {
        return value !== 0
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        return ['1', 'true', 'yes', 'on'].includes(normalized)
    }

    return false
}

export function normalizeText(value: unknown) {
    if (typeof value === 'string') {
        return value
    }

    if (value === null || value === undefined) {
        return ''
    }

    return String(value)
}

export function toRecord(value: unknown) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>
    }

    return {}
}

function normalizeSubpath(value: string) {
    return value.trim().replace(/^\/+/, '')
}

export function composeFs(remoteName: string, sourceSubpath: string) {
    const normalizedSubpath = normalizeSubpath(sourceSubpath)

    if (!normalizedSubpath) {
        return `${remoteName}:`
    }

    return `${remoteName}:/${normalizedSubpath}`
}

export function OptionField({
    option,
    value,
    onChange,
    showExamples = true,
}: {
    option: OptionFieldOption
    value: unknown
    onChange: (value: unknown) => void
    showExamples?: boolean
}) {
    const fieldId = useId()
    const { listId, helpTitle, description, examples, hasExamples } = useMemo(() => {
        const [nextHelpTitle, ...helpDetails] = (option.Help ?? '').split('\n')
        const nextExamples = showExamples ? (option.Examples ?? []) : []

        return {
            listId: `${fieldId}-examples`,
            helpTitle: nextHelpTitle,
            description: helpDetails.join('\n'),
            examples: nextExamples,
            hasExamples: nextExamples.length > 0,
        }
    }, [fieldId, option.Examples, option.Help, showExamples])

    if ((option.Hide ?? 0) !== 0) {
        return null
    }

    if (option.Type === 'bool') {
        return (
            <Field className="gap-2">
                <FieldLabel className="flex items-start gap-2">
                    <Checkbox
                        checked={normalizeBoolean(value)}
                        name={option.Name}
                        onCheckedChange={(nextValue) => onChange(nextValue === true)}
                    />
                    <FieldContent className="pt-0.5">
                        <FieldTitle>{option.Name}</FieldTitle>
                        {description ? <FieldDescription>{description}</FieldDescription> : null}
                    </FieldContent>
                </FieldLabel>
            </Field>
        )
    }

    return (
        <Field>
            <FieldLabel htmlFor={fieldId}>{option.Name}</FieldLabel>
            <Input
                id={fieldId}
                name={option.Name}
                type={option.IsPassword ? 'password' : 'text'}
                value={normalizeText(value)}
                onChange={(event) => onChange(event.target.value)}
                placeholder={helpTitle}
                required={option.Required}
                list={hasExamples ? listId : undefined}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
            />
            {hasExamples ? (
                <datalist id={listId}>
                    {examples.map((example, index) => (
                        <option
                            key={`${example.Value ?? 'example'}-${index}`}
                            value={example.Value}
                        >
                            {example.Help}
                        </option>
                    ))}
                </datalist>
            ) : null}
            {description ? <FieldDescription>{description}</FieldDescription> : null}
        </Field>
    )
}
