import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('luau-type-generator.generateType', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const text = document.getText();

        // Identify the base class declaration
        const classNameMatch = text.match(/local\s+(\w+)\s*=\s*\{\}/);
        if (!classNameMatch) {
            vscode.window.showErrorMessage("Could not identify a Luau class declaration.");
            return;
        }
        const className = classNameMatch[1];

        const properties = new Set<string>();
        const methods = new Map<string, string>();

        // IMPORTANT FIX: Isolate the constructor function block (.new) 
        // This prevents picking up property mutations inside other methods.
        const constructorRegex = new RegExp(`function\\s+${className}\\.new\\s*\\([\\s\\S]*?\\nend`, 'g');
        const constructorMatch = constructorRegex.exec(text);
        const constructorText = constructorMatch ? constructorMatch[0] : '';

        // Parse properties ONLY from the constructor scope
        const selfPropertyRegex = /self\.(\w+)(?:\s*:\s*([^=]+?))?\s*=\s*(.*)/g;
        let propMatch;
        while ((propMatch = selfPropertyRegex.exec(constructorText)) !== null) {
            const propName = propMatch[1];
            let type = propMatch[2] ? propMatch[2].trim() : null;
            
            // Clean value of any inline comments
            let val = propMatch[3].split('--')[0].trim();
            
            // Check if the value uses the Luau type casting operator (::)
            const castMatch = val.match(/::\s*(.+)/);
            if (castMatch) {
                type = castMatch[1].trim();
            }
            
            // If still no type, infer from primitives
            if (!type) {
                if (val === 'true' || val === 'false') type = 'boolean';
                else if (!isNaN(Number(val)) && val !== '') type = 'number';
                else if (val.startsWith('"') || val.startsWith("'")) type = 'string';
                else type = 'any';
            }
            properties.add(`    ${propName}: ${type},`);
        }

        // Parse methods from the FULL document
        const methodRegex = new RegExp(`function\\s+${className}([:.])(\\w+)\\s*\\(([^)]*)\\)(?:\\s*:\\s*(.+))?`, 'g');
        let methodMatch;
        while ((methodMatch = methodRegex.exec(text)) !== null) {
            const separator = methodMatch[1];
            const methodName = methodMatch[2];
            const argumentsText = methodMatch[3].trim();
            
            // Strip comments out of the return type if they exist
            const explicitReturn = methodMatch[4] ? methodMatch[4].split('--')[0].trim() : null;
            
            let signatureArgs = argumentsText;
            if (separator === ':') {
                signatureArgs = argumentsText ? `${className}, ${argumentsText}` : className;
            }

            let returnType = '()';
            if (explicitReturn) {
                returnType = explicitReturn;
            } else if (methodName === 'new') {
                returnType = className;
            }

            methods.set(methodName, `    ${methodName}: (${signatureArgs}) -> ${returnType},`);
        }

        // Construct the final type block
        let typeExport = `export type ${className} = {\n`;
        properties.forEach(prop => { typeExport += prop + '\n'; });
        methods.forEach(methodSignature => { typeExport += methodSignature + '\n'; });
        typeExport += `}\n\n`;

        // Safely locate existing block using bracket counting
        const exportStartRegex = new RegExp(`export\\s+type\\s+${className}\\s*=\\s*\\{`);
        const startMatch = exportStartRegex.exec(text);

        let existingRange: vscode.Range | null = null;

        if (startMatch) {
            const startIndex = startMatch.index;
            const braceStart = startIndex + startMatch[0].length - 1;
            let braceCount = 0;
            let endIndex = -1;
            
            // Count nested brackets to find the true end of the block
            for (let i = braceStart; i < text.length; i++) {
                if (text[i] === '{') braceCount++;
                else if (text[i] === '}') braceCount--;

                if (braceCount === 0) {
                    endIndex = i;
                    break;
                }
            }

            // Include trailing newlines in the replacement range
            if (endIndex !== -1) {
                let finalEndIndex = endIndex + 1;
                while (finalEndIndex < text.length && (text[finalEndIndex] === '\n' || text[finalEndIndex] === '\r')) {
                    finalEndIndex++;
                }
                existingRange = new vscode.Range(
                    document.positionAt(startIndex),
                    document.positionAt(finalEndIndex)
                );
            }
        }

        // Replace the old block or insert at the top
        editor.edit(editBuilder => {
            if (existingRange) {
                editBuilder.replace(existingRange, typeExport);
            } else {
                editBuilder.insert(new vscode.Position(0, 0), typeExport);
            }
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}