import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import {
    normalizeBoolean,
    normalizeText,
    OptionField,
    type OptionFieldOption,
} from '@/components/OptionField'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'

function upsertEditedValue(
    previous: Record<string, unknown>,
    name: string,
    value: unknown | undefined
) {
    if (value === undefined) {
        if (!(name in previous)) {
            return previous
        }

        const next = { ...previous }
        delete next[name]
        return next
    }

    return {
        ...previous,
        [name]: value,
    }
}

export function OptionGroupCard({
    title,
    description,
    options,
    initialValues,
    editedValues,
    setEditedValues,
    showAdvanced,
    onShowAdvancedChange,
}: {
    title: string
    description: string
    options: Array<OptionFieldOption & { Advanced?: boolean }>
    initialValues: Record<string, unknown>
    editedValues: Record<string, unknown>
    setEditedValues: Dispatch<SetStateAction<Record<string, unknown>>>
    showAdvanced: boolean
    onShowAdvancedChange: (value: boolean) => void
}) {
    const defaultOptions = options.filter((option) => option.Required || !option.Advanced)
    const advancedOptions = options.filter((option) => option.Advanced && !option.Required)
    const hasAdvancedOptions = advancedOptions.some((option) => (option.Hide ?? 0) === 0)
    const changedCount = Object.keys(editedValues).length

    function handleChange(option: OptionFieldOption, nextValue: unknown) {
        const initialValue = initialValues[option.Name]
        const matchesInitial =
            option.Type === 'bool'
                ? normalizeBoolean(nextValue) === normalizeBoolean(initialValue)
                : normalizeText(nextValue) === normalizeText(initialValue)

        setEditedValues((previous) =>
            upsertEditedValue(previous, option.Name, matchesInitial ? undefined : nextValue)
        )
    }

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
                <CardAction>
                    <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                        {changedCount} changed
                    </span>
                </CardAction>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
                <FieldGroup>
                    {defaultOptions.map((option) => (
                        <OptionField
                            key={option.Name}
                            option={option}
                            value={
                                editedValues[option.Name] !== undefined
                                    ? editedValues[option.Name]
                                    : initialValues[option.Name]
                            }
                            onChange={(nextValue) => handleChange(option, nextValue)}
                        />
                    ))}
                </FieldGroup>

                {hasAdvancedOptions ? (
                    <div className="space-y-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onShowAdvancedChange(!showAdvanced)}
                        >
                            {showAdvanced ? <ChevronUpIcon /> : <ChevronDownIcon />}
                            More options
                        </Button>

                        {showAdvanced ? (
                            <FieldGroup>
                                {advancedOptions.map((option) => (
                                    <OptionField
                                        key={option.Name}
                                        option={option}
                                        value={
                                            editedValues[option.Name] !== undefined
                                                ? editedValues[option.Name]
                                                : initialValues[option.Name]
                                        }
                                        onChange={(nextValue) => handleChange(option, nextValue)}
                                    />
                                ))}
                            </FieldGroup>
                        ) : null}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}
