import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

class RegexRender {
	public toDispose?: vscode.Disposable;


	public extract(text: string | undefined, regexString: string | undefined, group: any) {
		if (!regexString || !text || !Number.isInteger(group)) {
			return;
		}
		try {
			const rgx = new RegExp(regexString, 'g');
			const matches = text.matchAll(rgx);
			let result = "<xmp>";
			for (const match of matches) {
				result += match[group].toLocaleString() + '\n';
			}
			result += "</xmp>";


			this.createPanelIfNessessary();
			if (this.panel) {
				this.panel.webview.html = result;
			}
		} catch (error) {
			if (error instanceof SyntaxError && this.panel) {
				this.panel.webview.html = error.message;
			} else {
				console.log(error);
			}
		}
	}

	public update(file: vscode.Uri | undefined) {
		if (this.panel && file?.fsPath === this.sourceFile?.fsPath || file?.fsPath === this.templateFile?.fsPath || file?.fsPath === this.regexFile?.fsPath) {
			this._update();
		}
	}
	private panelGotDisposed(panelGotDisposed: any) {
		try {
			this.panel = undefined;
		} catch (error) {
			console.log(error);
		}

		if (this.toDispose) {
			this.toDispose?.dispose();
			this.toDispose = undefined;
		}
	}

	private createPanelIfNessessary() {
		if (!this.panel) {
			this.panel = vscode.window.createWebviewPanel('html', "Test", { viewColumn: vscode.ViewColumn.Beside }, {});
			this.panel.onDidDispose(this.panelGotDisposed);
		}
	}

	private _update() {
		try {
			if (this.sourceFile && this.templateFile && this.regexFile && this.panel) {
				const source = fs.readFileSync(this.sourceFile.fsPath).toLocaleString();
				const template = fs.readFileSync(this.templateFile.fsPath).toLocaleString();
				const regex = fs.readFileSync(this.regexFile.fsPath).toLocaleString();
				const rgx = new RegExp(regex, 'g');

				const matches = source.matchAll(rgx);

				let result = "<xmp>";
				let first = true;
				for (const match of matches) {
					let currentTemplate = template;
					currentTemplate = currentTemplate.replace(/\\n/g, "\n");
					currentTemplate = currentTemplate.replace(/\\r/g, "\r");
					currentTemplate = currentTemplate.replace(/\\t/g, '\t');
					for (let i = 0; i < match.length; ++i) {
						const toReplace = `$${i}`;
						currentTemplate = currentTemplate.replace(toReplace, match[i]);
					}
					result += currentTemplate;
				}
				result += "</xmp>";
				this.panel.webview.html = result;
			}
		} catch (error) {
			if (error instanceof SyntaxError && this.panel) {
				this.panel.webview.html = error.message;
			} else {
				console.log(error);
			}
		}

	}

	private panel?: vscode.WebviewPanel;
	private sourceFile?: vscode.Uri;
	private templateFile?: vscode.Uri;
	private regexFile?: vscode.Uri;

	public createOrShow(sourceFile: vscode.Uri | undefined, templateFile: vscode.Uri | undefined, valueFile: vscode.Uri | undefined) {
		if (!sourceFile || !templateFile || !valueFile) {
			return;
		}

		this.sourceFile = sourceFile;
		this.templateFile = templateFile;
		this.regexFile = valueFile;
		this.createPanelIfNessessary();
		this._update();
	}
}

export async function activate(context: vscode.ExtensionContext) {

	let regexRender: RegexRender = new RegexRender();

	let disposable2 = vscode.commands.registerCommand('regexextract.extractRegex', async () => {
		const text = vscode.window.activeTextEditor?.document.getText();
		if (!text) {
			return;
		}

		let p = new Promise<string>((resolve) => {
			const config = vscode.workspace.getConfiguration("regexextract");
			let items = config.get<string[]>('regexPresets');
			if (!items) {
				items = [];
			}
			const quickPick = vscode.window.createQuickPick();
			quickPick.placeholder = "Regex";
			quickPick.canSelectMany = false;
			quickPick.items = items.map((i) => ({ "label": i }));
			let extraValue: string = "";
			quickPick.onDidChangeValue((e) => {
				if (items && !items.includes(quickPick.value)) {
					quickPick.items = [quickPick.value, ...items].map(label => ({ label }));
				}
			});
			quickPick.onDidAccept(() => {
				if (quickPick.activeItems.length === 0) {
					resolve(quickPick.value);
				} else {
					resolve(quickPick.activeItems[0].label);
				}
				quickPick.hide();
			});
			quickPick.show();

		});

		const regexString = await p;
		console.log(regexString);

		regexRender.extract(text, regexString, 0);
	});

	let disposable3 = vscode.commands.registerCommand('regexextract.extractRegexFromGroup', async () => {
		const text = vscode.window.activeTextEditor?.document.getText();
		if (!text) {
			return;
		}

		let p = new Promise<string>((resolve) => {
			const config = vscode.workspace.getConfiguration("regexextract");
			let items = config.get<string[]>('regexPresets');
			if (!items) {
				items = [];
			}
			const quickPick = vscode.window.createQuickPick();
			quickPick.placeholder = "Regex";
			quickPick.canSelectMany = false;
			quickPick.items = items.map((i) => ({ "label": i }));
			let extraValue: string = "";
			quickPick.onDidChangeValue((e) => {
				if (items && !items.includes(quickPick.value)) {
					quickPick.items = [quickPick.value, ...items].map(label => ({ label }));
				}
			});
			quickPick.onDidAccept(() => {
				if (quickPick.activeItems.length === 0) {
					resolve(quickPick.value);
				} else {
					resolve(quickPick.activeItems[0].label);
				}
				quickPick.hide();
			});
			quickPick.show();

		});

		const regexString = await p;
		console.log(regexString);
		if (!regexString) {
			return;
		}

		const group = await Promise.resolve(vscode.window.showInputBox({ placeHolder: "Group", value: "1" }));
		if (group) {
			regexRender.extract(text, regexString, Number.parseInt(group));
		}
	});

	let disposable = vscode.commands.registerCommand('regexextract.renderRegex', async () => {

		const files: vscode.Uri[] = await Promise.resolve(vscode.workspace.findFiles('*'));
		let fileMap = new Map<string, vscode.Uri>();
		let fileNames = [];

		for (const file of files) {
			let key = path.basename(file.path);
			fileMap.set(key, file);
			fileNames.push(key);
		}

		const sourceFile = await Promise.resolve(vscode.window.showQuickPick(fileNames, {
			canPickMany: false,
			placeHolder: 'Source File'
		}));

		if (!sourceFile) {
			return;
		}

		fileNames = fileNames.filter(f => f !== sourceFile);


		const regexFile = await Promise.resolve(vscode.window.showQuickPick(fileNames, {
			canPickMany: false,
			placeHolder: 'Regex File'
		}));

		if (!regexFile) {
			return;
		}

		fileNames = fileNames.filter(f => f !== regexFile);

		const templateFile = await Promise.resolve(vscode.window.showQuickPick(fileNames, {
			canPickMany: false,
			placeHolder: 'Template File'
		}));

		// fileNames = fileNames.filter(f => f !== templateFile);

		if (templateFile && regexFile && sourceFile) {
			regexRender.createOrShow(fileMap.get(sourceFile), fileMap.get(templateFile), fileMap.get(regexFile));
			regexRender.toDispose = vscode.workspace.onDidSaveTextDocument((f) => {
				regexRender.update(f.uri);
			});
		}
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(disposable2);
}

export function deactivate() { }


