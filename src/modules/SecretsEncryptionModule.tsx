import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ModuleCardTitle } from "@/shared/ModuleCardTitle";
import { SecretsSection } from "@/modules/SecretsConfigModule";
import { EncryptionSection } from "@/modules/EncryptionModule";
import { useUnsavedChanges } from "@/shared/useUnsavedChanges";

export default function SecretsEncryptionModule() {
    const [secretsDirty, setSecretsDirty] = useState(false);
    const [encryptionDirty, setEncryptionDirty] = useState(false);
    const { dialog: unsavedDialog } = useUnsavedChanges({
        isDirty: () => secretsDirty || encryptionDirty,
        what: "page",
    });

    return (
        <div className="w-full space-y-4">
            <Card className="border-muted">
                <CardHeader>
                    <ModuleCardTitle title="Secrets & encryption" help="secrets-encryption" />
                </CardHeader>
                <CardContent className="space-y-8">
                    <SecretsSection onDirtyChange={setSecretsDirty} />
                    <Separator />
                    <EncryptionSection onDirtyChange={setEncryptionDirty} />
                </CardContent>
            </Card>
            {unsavedDialog}
        </div>
    );
}
