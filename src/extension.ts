import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('luau-type-generator.generateType', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const text = document.getText();

        // Identify the class declaration
        const classNameMatch = text.match(/local\s+(\w+)\s*=\s*\{\}/);
        if (!classNameMatch) {
            vscode.window.showErrorMessage("Could not identify a Luau class declaration.");
            return;
        }
        const className = classNameMatch[1];

        const properties = new Set<string>();
        const methods = new Map<string, string>();

        // Parse properties assigned to 'self'
        const selfPropertyRegex = /self\.(\w+)\s*(?::\s*([\w<>|&?:]+))?\s*=\s*(.*)/g;
        let propMatch;
        while ((propMatch = selfPropertyRegex.exec(text)) !== null) {
            const propName = propMatch[1];
            let type = propMatch[2] ? propMatch[2].trim() : null;
            
            if (!type) {
                const val = propMatch[3].trim();
                if (val === 'true' || val === 'false') type = 'boolean';
                else if (!isNaN(Number(val)) && val !== '') type = 'number';
                else if (val.startsWith('"') || val.startsWith("'")) type = 'string';
                else type = 'any';
            }
            properties.add(`    ${propName}: ${type},`);
        }

        // Parse class methods and explicit return types
        const methodRegex = new RegExp(`function\\s+${className}([:.])(\\w+)\\s*\\(([^)]*)\\)(?:\\s*:\\s*([^\\n]+))?`, 'g');
        let methodMatch;
        while ((methodMatch = methodRegex.exec(text)) !== null) {
            const separator = methodMatch[1];
            const methodName = methodMatch[2];
            const argumentsText = methodMatch[3].trim();
            const explicitReturn = methodMatch[4] ? methodMatch[4].trim() : null;
            
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

        // Construct the type export block
        let typeExport = `export type ${className} = {\n`;
        properties.forEach(prop => { typeExport += prop + '\n'; });
        methods.forEach(methodSignature => { typeExport += methodSignature + '\n'; });
        typeExport += `}\n\n`;

        // Check for an existing block to overwrite
        const existingTypeRegex = new RegExp(`export\\s+type\\s+${className}\\s*=\\s*\\{[\\s\\S]*?\\}\\n*`);
        const existingMatch = existingTypeRegex.exec(text);

        // Apply the edit to the document
        editor.edit(editBuilder => {
            if (existingMatch) {
                const startPos = document.positionAt(existingMatch.index);
                const endPos = document.positionAt(existingMatch.index + existingMatch[0].length);
                editBuilder.replace(new vscode.Range(startPos, endPos), typeExport);
            } else {
                editBuilder.insert(new vscode.Position(0, 0), typeExport);
            }
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}