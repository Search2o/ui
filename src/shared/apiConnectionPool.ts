import type { ApiConnectionPoolModel, ConnectionPoolModel } from "@/orval/search2o.schemas";

export type ConnectionFields = {
    maxConnections: string;
    maxKeepaliveConnections: string;
    keepaliveExpiry: string;
    timeoutConnect: string;
    timeoutRead: string;
    timeoutWrite: string;
    timeoutPool: string;
};

export type CertificateFields = {
    clientCertFile: string;
    privateKeyFile: string;
    caCertFile: string;
};

export type PoolFields = ConnectionFields & CertificateFields;

export function connectionToFields(
    pool: ConnectionPoolModel | ApiConnectionPoolModel | null | undefined,
): ConnectionFields {
    const p = pool ?? {};
    return {
        maxConnections: String(p.maxConnections ?? 20),
        maxKeepaliveConnections: String(p.maxKeepaliveConnections ?? 10),
        keepaliveExpiry: String(p.keepaliveExpiry ?? 60),
        timeoutConnect: String(p.timeout?.connect ?? 10),
        timeoutRead: String(p.timeout?.read ?? 300),
        timeoutWrite: String(p.timeout?.write ?? 30),
        timeoutPool: String(p.timeout?.pool ?? 10),
    };
}

export function poolToFields(pool: ApiConnectionPoolModel | null | undefined): PoolFields {
    const p = pool ?? {};
    return {
        ...connectionToFields(p),
        clientCertFile: p.clientCertFile ?? "",
        privateKeyFile: p.privateKeyFile ?? "",
        caCertFile: p.caCertFile ?? "",
    };
}

const NUMBERS: [keyof ConnectionFields, string][] = [
    ["maxConnections", "Max connections"],
    ["maxKeepaliveConnections", "Max keep-alive connections"],
    ["keepaliveExpiry", "Keep-alive expiry"],
    ["timeoutConnect", "Connect timeout"],
    ["timeoutRead", "Read timeout"],
    ["timeoutWrite", "Write timeout"],
    ["timeoutPool", "Pool timeout"],
];

export function fieldsToConnection<T extends ConnectionPoolModel>(
    fields: ConnectionFields,
    source: T,
): { ok: true; pool: T } | { ok: false; badField: string } {
    for (const [key, label] of NUMBERS) {
        const raw = fields[key].trim();
        const value = Number(raw);
        if (!raw || !Number.isFinite(value) || value < 0) return { ok: false, badField: label };
    }
    const num = (key: keyof ConnectionFields) => Number(fields[key].trim());
    return {
        ok: true,
        pool: {
            ...source,
            maxConnections: num("maxConnections"),
            maxKeepaliveConnections: num("maxKeepaliveConnections"),
            keepaliveExpiry: num("keepaliveExpiry"),
            timeout: {
                connect: num("timeoutConnect"),
                read: num("timeoutRead"),
                write: num("timeoutWrite"),
                pool: num("timeoutPool"),
            },
        },
    };
}

export function fieldsToPool(
    fields: PoolFields,
    source: ApiConnectionPoolModel,
): { ok: true; pool: ApiConnectionPoolModel } | { ok: false; badField: string } {
    const connection = fieldsToConnection(fields, source);
    if (!connection.ok) return connection;
    const text = (key: keyof CertificateFields) => fields[key].trim() || undefined;
    return {
        ok: true,
        pool: {
            ...connection.pool,
            clientCertFile: text("clientCertFile"),
            privateKeyFile: text("privateKeyFile"),
            caCertFile: text("caCertFile"),
        },
    };
}
