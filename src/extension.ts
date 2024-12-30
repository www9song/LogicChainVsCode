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

const informations = new Map<string,string >()

class CompletionItemProvider implements vscode.CompletionItemProvider {
	provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken
	): vscode.ProviderResult<vscode.CompletionItem[]> {
		const completionItems: vscode.CompletionItem[] = [];
		for (const [key, value] of informations.entries())
		{
			const item1 = new vscode.CompletionItem(key, vscode.CompletionItemKind.Text);
			item1.detail = value;
			item1.documentation = '插入 ' + key;
			item1.insertText = key;
			completionItems.push(item1);
		}
		return completionItems;
	}
}
class HoverProvider implements vscode.HoverProvider {
	provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
		const range = document.getWordRangeAtPosition(position, /[a-zA-Z0-9\u4e00-\u9fa5]+/g);
		if (range) {
			const word = document.getText(range);
			if (informations.has(word)) {
				return new vscode.Hover(informations.get(word) as string);
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
			if (informations.has(word)) {
				// const targetPosition = new vscode.Position(5, 1); // 目标定义位置
				// const targetRange = new vscode.Range(targetPosition, targetPosition);
				// const definitionLink = new vscode.DefinitionLink(targetRange, targetRange, document.uri);
				// return [definitionLink];
			}
		}
		return null
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
	context.subscriptions.push(vscode.languages.registerCompletionItemProvider('LogicChain', new CompletionItemProvider(), '.'));

}

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: number;
	tokenModifiers: number;
}
enum TokenType{
	FunctionCall,
	Condition,
	Paramters,
	needImplement
}
interface TokenInfo{
	name: string;
	line: number;
	startCharacter: number;
	length: number;
	tokenType?: TokenType
}


class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	async provideDocumentSemanticTokens(document: vscode.TextDocument, _token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const includeFilename = path.join(path.dirname(document.fileName), "Documents", path.basename(document.fileName).replace(/\.\w+$/, "") + ".ldoc")

		const file = await vscode.workspace.fs.readFile(vscode.Uri.file(includeFilename))
		if (file) {
			const lines = file.toString().split(/\r\n|\r|\n/);
			lines.forEach(l => {
				if (l.startsWith("\t"))
				{
					const [key, doc] = l.slice(1).split(":")
					informations.set(key,doc.slice(1,doc.length-1))
				}
			})
		}
		const allTokens = this._parseText(document.getText());
		const builder = new vscode.SemanticTokensBuilder();
		allTokens.forEach((token) => {
			builder.push(token.line, token.startCharacter, token.length, token.tokenType, token.tokenModifiers);
		});
		return builder.build();
	}

	private _parseText(text: string): IParsedToken[] {
		const r: IParsedToken[] = [];
		///([:：、\|\?？\s\r\n]+)|([-=]>)|([\[【][^\]】]+[\]】])|([\(（][^\)）]+[\)）])/g
		
		interface Value { line: string, tokens: TokenInfo[] }
		const lines = text.split(/\r\n|\r|\n/);
		const modules = new Map<string, Value>();
		const importedModules = new Set()
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].length && lines[i].startsWith("//") == false) {
				const importHeader = /^\s*(导入|import)[:：]/g.exec(lines[i])
				if (importHeader) {
					r.push({
						line: i,
						startCharacter: importHeader.index,
						length: importHeader[0].length - 1,
						tokenType: this._encodeTokenType("keyword"),
						tokenModifiers: this._encodeTokenModifiers(["documentation"])
					})
					let startIndex = importHeader.index + importHeader[0].length
					lines[i].slice(importHeader[0].length).split(/[ 、]/g).forEach((s, index) => {
						r.push({
							line: i,
							startCharacter: startIndex,
							length: s.length,
							tokenType: this._encodeTokenType("class"),
							tokenModifiers: this._encodeTokenModifiers(["documentation"])
						})
						startIndex += s.length + 1
						importedModules.add(s)
					})
				}
				else
				{
					const lineInfo = this.splitLine(lines[i], i)
					if (lineInfo.length > 1) {
						modules.set(lineInfo[0].name, { line: lines[i], tokens: lineInfo.slice(1) })
					}
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
		const conditions: { check: (value: TokenInfo,line:string) => boolean, type: TokenType }[] = [
			{
				check: (value, line) => { return modules.has(value.name) || importedModules.has(value.name) },
				type:TokenType.FunctionCall
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
		for (const [module,values] of modules.entries())
		{
			for (const value of values.tokens)
			{
				for (const condition of conditions)
				{
					if (condition.check(value,values.line)) {
						value.tokenType = condition.type
						break
					}
				}
			}
		}
		const getParsedToken = (value: TokenInfo): IParsedToken => {
			let ty = ""
			let modifiers ="documentation"
			switch (value.tokenType) {
				case TokenType.FunctionCall: ty = "function"; break;
				case TokenType.Condition: ty = "property"; break;
				case TokenType.Paramters: ty = "number"; break;
				case TokenType.needImplement: ty = "operator"; break;

			}
			const tokenType = this._encodeTokenType(ty)
			const tokenModifiers =13123
			return { startCharacter: value.startCharacter, length: value.length, line: value.line, tokenType:tokenType,tokenModifiers:tokenModifiers}
		}
		for (const [module, values] of modules.entries()) {
			for (const value of values.tokens) {
				if (value.tokenType) {
					r.push(getParsedToken(value))
				}
				
			}
		}
		return r
	}
	private splitLine(line: string,lineIndex:number): TokenInfo[]
	{
		const re: RegExp = /[a-zA-Z0-9\u4e00-\u9fa5]+/g
		const l: TokenInfo[] = []
		let res = re.exec(line)
		while (res!= null)
		{
			if (res.length > 0 && res[0].length && isNaN(parseFloat(res[0]))) {
				l.push({name:res[0], startCharacter:res.index,line:lineIndex,length:res[0].length})
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
