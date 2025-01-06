import * as vscode from 'vscode';
import * as path from 'path';
/**
 
 Tokentype
namespace	For identifiers that declare or reference a namespace, module, or package.
class	For identifiers that declare or reference a class type.
enum	For identifiers that declare or reference an enumeration type.
interface	For identifiers that declare or reference an interface type.
struct	For identifiers that declare or reference a struct type.
type	For identifiers that declare or reference a type that is not covered above.

typeParameter	For identifiers that declare or reference a type parameter.

parameter	For identifiers that declare or reference a function or method parameters.
variable	For identifiers that declare or reference a local or global variable.
property	For identifiers that declare or reference a member property, member field, or member variable.
enumMember	For identifiers that declare or reference an enumeration property, constant, or member.

decorator	For identifiers that declare or reference decorators and annotations.
event	For identifiers that declare an event property.
function	For identifiers that declare a function.
method	For identifiers that declare a member function or method.
macro	For identifiers that declare a macro.
label	For identifiers that declare a label.
comment	For tokens that represent a comment.
string	For tokens that represent a string literal.
keyword	For tokens that represent a language keyword.
number	For tokens that represent a number literal.
regexp	For tokens that represent a regular expression literal.
operator	For tokens that represent an operator.
 */
/**
 * 
 
Standard token modifiers:
declaration	For declarations of symbols.
definition	For definitions of symbols, for example, in header files.
readonly	For readonly variables and member fields (constants).
static	For class members (static members).
deprecated	For symbols that should no longer be used.
abstract	For types and member functions that are abstract.
async	For functions that are marked async.
modification	For variable references where the variable is assigned to.
documentation	For occurrences of symbols in documentation.
defaultLibrary	For symbols that are part of the standard library.
 */

const tokenTypes = new Map<string, number>();
const tokenModifiers = new Map<string, number>();
interface Value { line: string, tokens: TokenInfo[], doc: string,position:vscode.Position}
const currentFileModules = new Map<string, Value>();
const moduleNames = new Map<string,{ty:string,doc:string}>()
const comments = new Set<number>()
const moduleStartPrefix = new Set(["->", ":", "=>", "]", "】", "、", "："])
const computeStartPrefix = new Set([">", "<", "=", "%", "+", "-", "*", "/", "|", "&", ",", "，"])
class CompletionItemProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.CompletionItem[]> {
		const completionItems: vscode.CompletionItem[] = [];

		let word = ""
		let range = document.getWordRangeAtPosition(new vscode.Position(position.line, position.character - 1))
		if (!range) {
			range = document.getWordRangeAtPosition(new vscode.Position(position.line, position.character - 2))
		}
		if (range) {
			word = document.getText(range)
		}
		if (word != "") {
			if (moduleNames.has(word)) {
				for (const [key, value] of moduleNames.entries()) {
					const item1 = new vscode.CompletionItem(key, vscode.CompletionItemKind.Text);
					item1.detail = value.doc;
					item1.documentation = '插入 ' + key;
					item1.insertText = key;
					completionItems.push(item1);
				}
			}
			else {
				for (const [key, value] of moduleNames.entries()) {
					if (!moduleNames.has(key)) {
						const item1 = new vscode.CompletionItem(key, vscode.CompletionItemKind.Text);
						item1.detail = value.doc;
						item1.documentation = '插入 ' + key;
						item1.insertText = key;
						completionItems.push(item1);
					}
				}
			}
		}

		return completionItems;
	}
}
class HoverProvider implements vscode.HoverProvider {
	provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {

		const range = document.getWordRangeAtPosition(position, /[a-zA-Z0-9\u4e00-\u9fa5]+/g);
		if (range) {
			const word = document.getText(range);
			if (moduleNames.has(word)) {
				const info =  moduleNames.get(word)
				return new vscode.Hover(new vscode.MarkdownString("#### "+info?.ty+"\n* "  + info?.doc as string));
			}
			else if (currentFileModules.has(word)) {
				const value:Value|undefined = currentFileModules.get(word)
				if (value) {
					return new vscode.Hover(new vscode.MarkdownString(value.doc || `#### 本地模块\n* 第${ value.position.line + 1}行`, true))
				}
				
			}
			else {
				if (!comments.has(position.line)&& isNaN(parseFloat(word))) {
					return new vscode.Hover(new vscode.MarkdownString("#### 缺失\n* 未实现!!!", true))
				}
			}
		}
	}
}
class DefinitionProvider implements vscode.DefinitionProvider {
	provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.DefinitionLink[]> {
		const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z0-9\u4e00-\u9fa5]+/g);
		if (wordRange) {
			const word = document.getText(wordRange);
			// 根据逻辑查找符号的定义
			if (currentFileModules.has(word)) {
				const value:Value|undefined = currentFileModules.get(word)
				if (value) {
					const range = document.getWordRangeAtPosition(value.position, /[a-zA-Z0-9\u4e00-\u9fa5]+/g)
					if (range) {
						return {range:range,uri:document.uri}
					}
				}
			}
		}
		return null
	}
}
class ReferenceProvider implements vscode.ReferenceProvider {
    provideReferences(
		document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Location[]> {
        // 这里是查找引用的逻辑
		const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z0-9\u4e00-\u9fa5]+/g);
		if (wordRange) {
			const word = document.getText(wordRange);
			const locations: vscode.Location[] = [];
			const referenceLocation = new vscode.Location(document.uri, new vscode.Position(0, 0));
			locations.push(referenceLocation);
			
			return locations
		}
    }
}

export function activate(context: vscode.ExtensionContext) {
	const defaultTokenTypes = [
		'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
		'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
		'method', 'decorator', 'macro', 'variable', 'parameter', 'property', 'label'
	]
	const defaultTokenModifiers = ['declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated', 'modification', 'async']
	defaultTokenTypes.forEach((type, i) => tokenTypes.set(type, i))
	defaultTokenModifiers.forEach((type, i) => tokenModifiers.set(type, i))
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'LogicChain' }, new DocumentSemanticTokensProvider(), {
		tokenTypes: defaultTokenTypes,
		tokenModifiers: defaultTokenModifiers,
	}));


	// 注册 Hover 提供者
	context.subscriptions.push(vscode.languages.registerHoverProvider('LogicChain', new HoverProvider()));

	// 注册 Hover 提供者
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('LogicChain', new CompletionItemProvider(), ...moduleStartPrefix, ...computeStartPrefix));
	// 注册 Definition 提供者
	context.subscriptions.push(vscode.languages.registerDefinitionProvider('LogicChain', new DefinitionProvider()));
}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: number;
	tokenModifiers: number;
}
enum TokenType {
	FunctionCall,
	Condition,
	Paramters,
	needImplement
}
interface TokenInfo {
	name: string;
	line: number;
	startCharacter: number;
	length: number;
	tokenType?: TokenType
}


class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	async provideDocumentSemanticTokens(document: vscode.TextDocument, _token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const includeFilename = path.join(path.dirname(document.fileName), "Documents", path.basename(document.fileName).replace(/\.\w+$/, "") + ".ldoc")
		moduleNames.clear()
		try 
		{
			const file = await vscode.workspace.fs.readFile(vscode.Uri.file(includeFilename))
			if (file) {
				const lines = file.toString().split(/\r\n|\r|\n/);
				let ty = ""
				lines.forEach(l => {
					if (l.length) {
						if (l.startsWith("\t")) {
							const [key, doc] = l.slice(1).split(":")
							moduleNames.set(key,{ty:ty,doc:doc})
						}
						else {
							ty = l.slice(0,l.length -1)
						}
					}
				
				})
			}
		}
		finally{
			
			const allTokens = this._parseText(document.getText());
			const builder = new vscode.SemanticTokensBuilder();
			allTokens.forEach((token) => {
				builder.push(token.line, token.startCharacter, token.length, token.tokenType, token.tokenModifiers);
			});
			return builder.build();
		}
		
	}

	private _parseText(text: string): IParsedToken[] {
		const r: IParsedToken[] = [];

		const lines = text.split(/\r\n|\r|\n/);
		comments.clear()
		currentFileModules.clear()
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].length) {
				if (!lines[i].match(/^\s*\/\//g)) {
					const lineInfo = this.splitLine(lines[i], i)
					if (lineInfo.length > 0) {
						let doc = ""
						if (i > 0 && lines[i - 1].match(/^\s*\/\//g)) {
							doc = lines[i - 1].slice(lines[i - 1].indexOf("//") + 2)
						}
						currentFileModules.set(lineInfo[0].name, { line: lines[i], tokens: lineInfo.slice(1), doc: doc,position:new vscode.Position(lineInfo[0].line,lineInfo[0].startCharacter) })
					}

				} else {
					comments.add(i)
				}
			}
		}
		function isInRange(line: string, start: string, end: string, value: TokenInfo): boolean {

			const forwardEndIndex = line.indexOf(end, value.startCharacter)
			if (forwardEndIndex != -1) {
				const forwardStartIndex = line.indexOf(start, value.startCharacter)
				return forwardStartIndex == -1 || forwardEndIndex < forwardStartIndex
			}
			const behindStartIndex = line.lastIndexOf(start, value.startCharacter)

			if (behindStartIndex != -1) {
				const behindEndIndex = line.lastIndexOf(end, value.startCharacter)
				return behindEndIndex == -1 || behindStartIndex > behindEndIndex
			}
			return false
		}
		const conditions: { check: (value: TokenInfo, line: string) => boolean, type: TokenType }[] = [
			{
				check: (value, line) => { 
					if (currentFileModules.has(value.name)) {
						return true
					}
					const info = moduleNames.get(value.name)
					if (info) {
						return info.ty.includes("模块")
					}
					return  false
				},
				type: TokenType.FunctionCall
			},
			{
				check: (value, line) => { return isInRange(line, "[", "]", value) || isInRange(line, '【', '】', value) },
				type: TokenType.Condition
			},
			{
				check: (value, line) => { return isInRange(line, "(", ")", value) || isInRange(line, '（', '）', value) },
				type: TokenType.Paramters
			},
			{
				check: (value, line) => { return true },
				type: TokenType.needImplement
			},
		]
		for (const [module, values] of currentFileModules.entries()) {
			for (const value of values.tokens) {
				for (const condition of conditions) {
					if (condition.check(value, values.line)) {
						value.tokenType = condition.type
						break
					}
				}
			}
		}
		const getParsedToken = (value: TokenInfo): IParsedToken => {
			let ty = ""
			let modifiers = "documentation"
			switch (value.tokenType) {
				case TokenType.FunctionCall: ty = "function"; break;
				case TokenType.Condition: ty = moduleNames.has(value.name) ? "property" : "operator"; break;
				case TokenType.Paramters: ty = moduleNames.has(value.name) ? "number" : "operator"; break;
				case TokenType.needImplement: ty = "operator"; break;

			}
			const tokenType = this._encodeTokenType(ty)
			const tokenModifiers = this._encodeTokenModifiers([modifiers])
			return { startCharacter: value.startCharacter, length: value.length, line: value.line, tokenType: tokenType, tokenModifiers: tokenModifiers }
		}
		for (const [module, values] of currentFileModules.entries()) {
			for (const value of values.tokens) {
				if (value.tokenType) {
					r.push(getParsedToken(value))
				}

			}
		}
		return r
	}
	private splitLine(line: string, lineIndex: number): TokenInfo[] {
		const re: RegExp = /\s*[a-zA-Z0-9\u4e00-\u9fa5]+/g
		const l: TokenInfo[] = []
		let res = re.exec(line)
		while (res != null) {
			if (res.length > 0 && res[0].length && isNaN(parseFloat(res[0]))) {
				const name = res[0].replace(/\s*/, "")
				const size = (res[0].length - name.length)
				l.push({ name: res[0].replace(/\s*/, ""), startCharacter: res.index + size, line: lineIndex, length:name.length })
			}
			res = re.exec(line)
		}
		return l
	}
	private _encodeTokenType(tokenType: string): number {
		if (tokenTypes.has(tokenType)) {
			return tokenTypes.get(tokenType)!;
		} else if (tokenType === 'notInLegend') {
			return tokenTypes.size + 2;
		}
		return 0;
	}

	private _encodeTokenModifiers(strTokenModifiers: string[]): number {
		let result = 0;
		for (const tokenModifier of strTokenModifiers) {
			if (tokenModifiers.has(tokenModifier)) {
				result = result | (1 << tokenModifiers.get(tokenModifier)!);
			} else if (tokenModifier === 'notInLegend') {
				result = result | (1 << tokenModifiers.size + 2);
			}
		}
		return result;
	}
}
