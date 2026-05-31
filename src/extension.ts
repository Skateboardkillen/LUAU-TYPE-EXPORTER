import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('luau-type-generator.generateType', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const document = editor.document;
        const text = document.getText();

        // 1. Identify the class/module name
        const classNameMatch = text.match(/local\s+(\w+)\s*=\s*\{\}/);
        if (!classNameMatch) {
            vscode.window.showErrorMessage("Could not identify a Luau class declaration (e.g., 'local ClassName = {}').");
            return;
        }
        const className = classNameMatch[1];

        const properties = new Set<string>();
        const methods = new Map<string, string>();

        // 2. Parse Properties assigned to 'self'
        const selfPropertyRegex = /self\.(\w+)\s*(?::\s*([\w<>|&?:]+))?\s*=/g;
        let propMatch;
        while ((propMatch = selfPropertyRegex.exec(text)) !== null) {
            const propName = propMatch[1];
            const explicitType = propMatch[2] ? propMatch[2].trim() : 'any';
            properties.add(`    ${propName}: ${explicitType},`);
        }

        // 3. Parse Methods
        const methodRegex = new RegExp(`function\\s+${className}[:.](\\w+)\\s*\\(([^)]*)\\)`, 'g');
        let methodMatch;
        while ((methodMatch = methodRegex.exec(text)) !== null) {
            const methodName = methodMatch[1];
            const argumentsText = methodMatch[2].trim();
            const formattedArgs = argumentsText ? argumentsText : "";
            methods.set(methodName, `    ${methodName}: (${className}, ${formattedArgs}) -> (),`);
        }

        // 4. Construct the Export Type block
        let typeExport = `export type ${className} = {\n`;
        properties.forEach(prop => {
            typeExport += prop + '\n';
        });
        methods.forEach(methodSignature => {
            typeExport += methodSignature + '\n';
        });
        typeExport += `}\n\n`;

        // 5. Look for an existing type export block to overwrite
        // This regex captures "export type ClassName = { ... }" and any trailing blank lines
        const existingTypeRegex = new RegExp(`export\\s+type\\s+${className}\\s*=\\s*\\{[\\s\\S]*?\\}\\n*`);
        const existingMatch = existingTypeRegex.exec(text);

        // 6. Apply the edit (Replace if found, Insert if new)
        editor.edit(editBuilder => {
            if (existingMatch) {
                // Find the exact document coordinates of the existing block
                const startPos = document.positionAt(existingMatch.index);
                const endPos = document.positionAt(existingMatch.index + existingMatch[0].length);
                const range = new vscode.Range(startPos, endPos);
                
                // Overwrite it
                editBuilder.replace(range, typeExport);
            } else {
                // Insert at the top of the file
                editBuilder.insert(new vscode.Position(0, 0), typeExport);
            }
        }).then(success => {
            if (success) {
                // Give dynamic feedback based on what action was taken
                vscode.window.showInformationMessage(existingMatch 
                    ? `Successfully updated export type for ${className}!` 
                    : `Successfully generated export type for ${className}!`);
            }
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}