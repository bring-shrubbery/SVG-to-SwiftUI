import type { LanguageServiceManager } from '../LanguageServiceManager';
import type { SignatureHelpProvider } from '../../interfaces';
import { Position, SignatureHelpContext, SignatureHelp, CancellationToken } from 'vscode-languageserver';
import { AstroDocument } from '../../../core/documents';
export declare class SignatureHelpProviderImpl implements SignatureHelpProvider {
    private readonly languageServiceManager;
    constructor(languageServiceManager: LanguageServiceManager);
    private static readonly triggerCharacters;
    private static readonly retriggerCharacters;
    getSignatureHelp(document: AstroDocument, position: Position, context: SignatureHelpContext | undefined, cancellationToken?: CancellationToken): Promise<SignatureHelp | null>;
    private isReTrigger;
    private isTriggerCharacter;
    /**
     * adopted from https://github.com/microsoft/vscode/blob/265a2f6424dfbd3a9788652c7d376a7991d049a3/extensions/typescript-language-features/src/languageFeatures/signatureHelp.ts#L103
     */
    private toTsTriggerReason;
    /**
     * adopted from https://github.com/microsoft/vscode/blob/265a2f6424dfbd3a9788652c7d376a7991d049a3/extensions/typescript-language-features/src/languageFeatures/signatureHelp.ts#L73
     */
    private toSignatureHelpInformation;
}
