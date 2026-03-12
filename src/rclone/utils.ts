import { toRecord } from '@/components/OptionField'

export function getRemoteName(fs: string) {
    const separatorIndex = fs.indexOf(':')
    if (separatorIndex > 0) {
        return fs.slice(0, separatorIndex)
    }

    return fs
}

export function hasTruthyValue(config: Record<string, unknown>, keys: string[]) {
    return keys.some((key) => {
        const value = config[key]

        if (typeof value === 'string') {
            return value.trim().length > 0
        }

        if (typeof value === 'boolean') {
            return value
        }

        if (typeof value === 'number') {
            return value !== 0
        }

        if (Array.isArray(value)) {
            return value.length > 0
        }

        return value !== null && value !== undefined
    })
}

export function getServeAuthLabel(params: unknown) {
    const paramsRecord = toRecord(params)
    const optRecord = toRecord(paramsRecord.opt)
    const merged = {
        ...paramsRecord,
        ...optRecord,
    }

    if (hasTruthyValue(merged, ['no_auth'])) {
        return 'none'
    }

    if (
        hasTruthyValue(merged, [
            'key',
            'key_file',
            'key_file_pass',
            'key_pem',
            'authorized_keys',
            'authorized_keys_file',
        ])
    ) {
        return 'key'
    }

    if (hasTruthyValue(merged, ['user', 'username', 'pass', 'password', 'htpasswd'])) {
        return 'basic'
    }

    if (hasTruthyValue(merged, ['auth_proxy'])) {
        return 'proxy'
    }

    return 'none'
}
