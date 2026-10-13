import { TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/shared/FieldLabel";
import { useFieldHelp, useFieldTitle } from "@/shared/fieldHelp";
import type { CertificateFields, ConnectionFields } from "@/shared/apiConnectionPool";

const NUMERIC_FIELDS = [
    { key: "maxConnections", label: "Max connections", help: "maxConnections" },
    {
        key: "maxKeepaliveConnections",
        label: "Max keep-alive connections",
        help: "maxKeepaliveConnections",
    },
    { key: "keepaliveExpiry", label: "Keep-alive expiry (sec)", help: "keepaliveExpiry" },
] as const;

const TIMEOUT_FIELDS = [
    { key: "timeoutConnect", label: "Connect (sec)", help: "connect" },
    { key: "timeoutRead", label: "Read (sec)", help: "read" },
    { key: "timeoutWrite", label: "Write (sec)", help: "write" },
    { key: "timeoutPool", label: "Pool (sec)", help: "pool" },
] as const;

const CLIENT_CERT_FIELDS = [
    {
        key: "clientCertFile",
        label: "Client certificate file",
        placeholder: "/etc/search2o/tls/client.pem",
    },
    {
        key: "privateKeyFile",
        label: "Private key file",
        placeholder: "/etc/search2o/tls/client-key.pem",
    },
] as const;

const CA_CERT_FIELDS = [
    {
        key: "caCertFile",
        label: "CA certificate file",
        placeholder: "/etc/search2o/tls/proxy-ca.pem",
    },
] as const;

export function ApiConnectionPoolFields({
    idPrefix,
    fields,
    onChange,
    disabled,
}: {
    idPrefix: string;
    fields: ConnectionFields;
    onChange: (patch: Partial<ConnectionFields>) => void;
    disabled?: boolean;
}) {
    const fh = useFieldHelp("ApiConnectionPoolModel", "TimeoutModel");

    return (
        <div className="space-y-6">
            <div className="grid max-w-4xl gap-4 md:grid-cols-3">
                {NUMERIC_FIELDS.map((field) => (
                    <div key={field.key} className="grid gap-2">
                        <FieldLabel help={fh(field.help)} htmlFor={`${idPrefix}-${field.key}`}>
                            {field.label}
                        </FieldLabel>
                        <Input
                            id={`${idPrefix}-${field.key}`}
                            type="number"
                            min={0}
                            step={1}
                            value={fields[field.key]}
                            onChange={(e) => onChange({ [field.key]: e.target.value })}
                            disabled={disabled}
                        />
                    </div>
                ))}
            </div>

            <div className="space-y-3">
                <div className="text-sm font-medium">Timeout</div>
                <div className="grid max-w-4xl gap-4 md:grid-cols-4">
                    {TIMEOUT_FIELDS.map((field) => (
                        <div key={field.key} className="grid gap-2">
                            <FieldLabel help={fh(field.help)} htmlFor={`${idPrefix}-${field.key}`}>
                                {field.label}
                            </FieldLabel>
                            <Input
                                id={`${idPrefix}-${field.key}`}
                                type="number"
                                min={0}
                                step={0.1}
                                value={fields[field.key]}
                                onChange={(e) => onChange({ [field.key]: e.target.value })}
                                disabled={disabled}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ApiConnectionPoolCertificates({
    idPrefix,
    fields,
    onChange,
    warning,
    disabled,
}: {
    idPrefix: string;
    fields: CertificateFields;
    onChange: (patch: Partial<CertificateFields>) => void;
    warning: string;
    disabled?: boolean;
}) {
    const fh = useFieldHelp("ApiConnectionPoolModel");
    const ft = useFieldTitle("ApiConnectionPoolModel");

    const textField = (key: keyof CertificateFields, label: string, placeholder: string) => (
        <div key={key} className="grid gap-2">
            <FieldLabel help={fh(key)} htmlFor={`${idPrefix}-${key}`}>
                {ft(key, label)}
            </FieldLabel>
            <Input
                id={`${idPrefix}-${key}`}
                value={fields[key]}
                placeholder={placeholder}
                onChange={(e) => onChange({ [key]: e.target.value })}
                disabled={disabled}
            />
        </div>
    );

    return (
        <div className="space-y-4">
            <div
                role="note"
                className="flex max-w-4xl items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5"
            >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <p className="text-sm font-medium text-foreground">{warning}</p>
            </div>

            <div className="space-y-3">
                <div className="text-sm font-medium">Client certificate</div>
                <div className="grid max-w-4xl gap-4 md:grid-cols-3">
                    {CLIENT_CERT_FIELDS.map((f) => textField(f.key, f.label, f.placeholder))}
                </div>
            </div>

            <div className="space-y-3">
                <div className="text-sm font-medium">Trusted certificate authority</div>
                <div className="grid max-w-4xl gap-4 md:grid-cols-3">
                    {CA_CERT_FIELDS.map((f) => textField(f.key, f.label, f.placeholder))}
                </div>
            </div>
        </div>
    );
}
