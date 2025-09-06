package main

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// AnalysisResult represents the complete analysis of a Go file
type AnalysisResult struct {
	Package     PackageInfo     `json:"package"`
	Imports     []ImportInfo    `json:"imports"`
	Functions   []FunctionInfo  `json:"functions"`
	Structs     []StructInfo    `json:"structs"`
	Interfaces  []InterfaceInfo `json:"interfaces"`
	Constants   []ConstantInfo  `json:"constants"`
	Variables   []VariableInfo  `json:"variables"`
	Types       []TypeInfo      `json:"types"`
	Comments    []CommentInfo   `json:"comments"`
	Todos       []TodoInfo      `json:"todos"`
}

type PackageInfo struct {
	Name string `json:"name"`
	Path string `json:"path"`
}

type ImportInfo struct {
	Path  string `json:"path"`
	Name  string `json:"name"`
	Alias string `json:"alias,omitempty"`
}

type FunctionInfo struct {
	Name        string          `json:"name"`
	Parameters  []ParameterInfo `json:"parameters"`
	Results     []ParameterInfo `json:"results"`
	Receiver    *ReceiverInfo   `json:"receiver,omitempty"`
	Doc         string          `json:"doc,omitempty"`
	IsExported  bool            `json:"isExported"`
	StartLine   int             `json:"startLine"`
	EndLine     int             `json:"endLine"`
}

type ParameterInfo struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type ReceiverInfo struct {
	Name      string `json:"name"`
	Type      string `json:"type"`
	IsPointer bool   `json:"isPointer"`
}

type StructInfo struct {
	Name       string      `json:"name"`
	Fields     []FieldInfo `json:"fields"`
	Doc        string      `json:"doc,omitempty"`
	IsExported bool        `json:"isExported"`
	StartLine  int         `json:"startLine"`
	EndLine    int         `json:"endLine"`
}

type FieldInfo struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Tag        string `json:"tag,omitempty"`
	Doc        string `json:"doc,omitempty"`
	IsExported bool   `json:"isExported"`
}

type InterfaceInfo struct {
	Name       string         `json:"name"`
	Methods    []MethodInfo   `json:"methods"`
	Doc        string         `json:"doc,omitempty"`
	IsExported bool           `json:"isExported"`
	StartLine  int            `json:"startLine"`
	EndLine    int            `json:"endLine"`
}

type MethodInfo struct {
	Name       string          `json:"name"`
	Parameters []ParameterInfo `json:"parameters"`
	Results    []ParameterInfo `json:"results"`
	Doc        string          `json:"doc,omitempty"`
}

type ConstantInfo struct {
	Name       string `json:"name"`
	Type       string `json:"type,omitempty"`
	Value      string `json:"value,omitempty"`
	Doc        string `json:"doc,omitempty"`
	IsExported bool   `json:"isExported"`
}

type VariableInfo struct {
	Name       string `json:"name"`
	Type       string `json:"type,omitempty"`
	Value      string `json:"value,omitempty"`
	Doc        string `json:"doc,omitempty"`
	IsExported bool   `json:"isExported"`
}

type TypeInfo struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Doc        string `json:"doc,omitempty"`
	IsExported bool   `json:"isExported"`
}

type CommentInfo struct {
	Text      string `json:"text"`
	StartLine int    `json:"startLine"`
	EndLine   int    `json:"endLine"`
}

type TodoInfo struct {
	Type    string `json:"type"`
	Content string `json:"content"`
	Line    int    `json:"line"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s <go-file>\n", os.Args[0])
		os.Exit(1)
	}

	filename := os.Args[1]
	result, err := analyzeGoFile(filename)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error analyzing file: %v\n", err)
		os.Exit(1)
	}

	output, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error marshaling JSON: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(output))
}

func analyzeGoFile(filename string) (*AnalysisResult, error) {
	fset := token.NewFileSet()
	
	// Parse the file
	file, err := parser.ParseFile(fset, filename, nil, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("failed to parse file: %w", err)
	}

	result := &AnalysisResult{
		Package: PackageInfo{
			Name: file.Name.Name,
			Path: filepath.Dir(filename),
		},
	}

	// Extract imports
	for _, imp := range file.Imports {
		importInfo := ImportInfo{
			Path: strings.Trim(imp.Path.Value, `"`),
		}
		if imp.Name != nil {
			importInfo.Name = imp.Name.Name
			if imp.Name.Name != "." && imp.Name.Name != "_" {
				importInfo.Alias = imp.Name.Name
			}
		}
		result.Imports = append(result.Imports, importInfo)
	}

	// Extract declarations
	for _, decl := range file.Decls {
		switch d := decl.(type) {
		case *ast.FuncDecl:
			funcInfo := extractFunction(fset, d)
			result.Functions = append(result.Functions, funcInfo)
		case *ast.GenDecl:
			switch d.Tok {
			case token.TYPE:
				for _, spec := range d.Specs {
					if ts, ok := spec.(*ast.TypeSpec); ok {
						switch t := ts.Type.(type) {
						case *ast.StructType:
							structInfo := extractStruct(fset, ts, t, d.Doc)
							result.Structs = append(result.Structs, structInfo)
						case *ast.InterfaceType:
							interfaceInfo := extractInterface(fset, ts, t, d.Doc)
							result.Interfaces = append(result.Interfaces, interfaceInfo)
						default:
							typeInfo := extractType(fset, ts, d.Doc)
							result.Types = append(result.Types, typeInfo)
						}
					}
				}
			case token.CONST:
				for _, spec := range d.Specs {
					if vs, ok := spec.(*ast.ValueSpec); ok {
						for _, name := range vs.Names {
							constInfo := extractConstant(fset, name, vs, d.Doc)
							result.Constants = append(result.Constants, constInfo)
						}
					}
				}
			case token.VAR:
				for _, spec := range d.Specs {
					if vs, ok := spec.(*ast.ValueSpec); ok {
						for _, name := range vs.Names {
							varInfo := extractVariable(fset, name, vs, d.Doc)
							result.Variables = append(result.Variables, varInfo)
						}
					}
				}
			}
		}
	}

	// Extract comments and TODOs
	for _, commentGroup := range file.Comments {
		for _, comment := range commentGroup.List {
			pos := fset.Position(comment.Pos())
			commentInfo := CommentInfo{
				Text:      strings.TrimPrefix(comment.Text, "//"),
				StartLine: pos.Line,
				EndLine:   pos.Line,
			}
			result.Comments = append(result.Comments, commentInfo)

			// Check for TODOs
			if todo := extractTodo(comment.Text, pos.Line); todo != nil {
				result.Todos = append(result.Todos, *todo)
			}
		}
	}

	return result, nil
}

func extractFunction(fset *token.FileSet, fn *ast.FuncDecl) FunctionInfo {
	startPos := fset.Position(fn.Pos())
	endPos := fset.Position(fn.End())

	funcInfo := FunctionInfo{
		Name:       fn.Name.Name,
		IsExported: ast.IsExported(fn.Name.Name),
		StartLine:  startPos.Line,
		EndLine:    endPos.Line,
	}

	if fn.Doc != nil {
		funcInfo.Doc = strings.TrimSpace(fn.Doc.Text())
	}

	// Extract receiver
	if fn.Recv != nil && len(fn.Recv.List) > 0 {
		recv := fn.Recv.List[0]
		receiverInfo := &ReceiverInfo{}
		
		if len(recv.Names) > 0 {
			receiverInfo.Name = recv.Names[0].Name
		}
		
		switch t := recv.Type.(type) {
		case *ast.StarExpr:
			receiverInfo.IsPointer = true
			if ident, ok := t.X.(*ast.Ident); ok {
				receiverInfo.Type = ident.Name
			}
		case *ast.Ident:
			receiverInfo.Type = t.Name
		}
		
		funcInfo.Receiver = receiverInfo
	}

	// Extract parameters
	if fn.Type.Params != nil {
		for _, param := range fn.Type.Params.List {
			typeStr := exprToString(param.Type)
			if len(param.Names) > 0 {
				for _, name := range param.Names {
					funcInfo.Parameters = append(funcInfo.Parameters, ParameterInfo{
						Name: name.Name,
						Type: typeStr,
					})
				}
			} else {
				funcInfo.Parameters = append(funcInfo.Parameters, ParameterInfo{
					Type: typeStr,
				})
			}
		}
	}

	// Extract results
	if fn.Type.Results != nil {
		for _, result := range fn.Type.Results.List {
			typeStr := exprToString(result.Type)
			if len(result.Names) > 0 {
				for _, name := range result.Names {
					funcInfo.Results = append(funcInfo.Results, ParameterInfo{
						Name: name.Name,
						Type: typeStr,
					})
				}
			} else {
				funcInfo.Results = append(funcInfo.Results, ParameterInfo{
					Type: typeStr,
				})
			}
		}
	}

	return funcInfo
}

func extractStruct(fset *token.FileSet, ts *ast.TypeSpec, st *ast.StructType, doc *ast.CommentGroup) StructInfo {
	startPos := fset.Position(ts.Pos())
	endPos := fset.Position(ts.End())

	structInfo := StructInfo{
		Name:       ts.Name.Name,
		IsExported: ast.IsExported(ts.Name.Name),
		StartLine:  startPos.Line,
		EndLine:    endPos.Line,
	}

	if doc != nil {
		structInfo.Doc = strings.TrimSpace(doc.Text())
	}

	// Extract fields
	for _, field := range st.Fields.List {
		typeStr := exprToString(field.Type)
		var tag string
		if field.Tag != nil {
			tag = strings.Trim(field.Tag.Value, "`")
		}

		if len(field.Names) > 0 {
			for _, name := range field.Names {
				fieldInfo := FieldInfo{
					Name:       name.Name,
					Type:       typeStr,
					Tag:        tag,
					IsExported: ast.IsExported(name.Name),
				}
				if field.Doc != nil {
					fieldInfo.Doc = strings.TrimSpace(field.Doc.Text())
				}
				structInfo.Fields = append(structInfo.Fields, fieldInfo)
			}
		} else {
			// Embedded field
			fieldInfo := FieldInfo{
				Type:       typeStr,
				Tag:        tag,
				IsExported: true, // Embedded fields are typically exported
			}
			structInfo.Fields = append(structInfo.Fields, fieldInfo)
		}
	}

	return structInfo
}

func extractInterface(fset *token.FileSet, ts *ast.TypeSpec, it *ast.InterfaceType, doc *ast.CommentGroup) InterfaceInfo {
	startPos := fset.Position(ts.Pos())
	endPos := fset.Position(ts.End())

	interfaceInfo := InterfaceInfo{
		Name:       ts.Name.Name,
		IsExported: ast.IsExported(ts.Name.Name),
		StartLine:  startPos.Line,
		EndLine:    endPos.Line,
	}

	if doc != nil {
		interfaceInfo.Doc = strings.TrimSpace(doc.Text())
	}

	// Extract methods
	for _, method := range it.Methods.List {
		if len(method.Names) > 0 {
			// Regular method
			for _, name := range method.Names {
				if funcType, ok := method.Type.(*ast.FuncType); ok {
					methodInfo := MethodInfo{
						Name: name.Name,
					}

					if method.Doc != nil {
						methodInfo.Doc = strings.TrimSpace(method.Doc.Text())
					}

					// Extract parameters
					if funcType.Params != nil {
						for _, param := range funcType.Params.List {
							typeStr := exprToString(param.Type)
							if len(param.Names) > 0 {
								for _, paramName := range param.Names {
									methodInfo.Parameters = append(methodInfo.Parameters, ParameterInfo{
										Name: paramName.Name,
										Type: typeStr,
									})
								}
							} else {
								methodInfo.Parameters = append(methodInfo.Parameters, ParameterInfo{
									Type: typeStr,
								})
							}
						}
					}

					// Extract results
					if funcType.Results != nil {
						for _, result := range funcType.Results.List {
							typeStr := exprToString(result.Type)
							if len(result.Names) > 0 {
								for _, resultName := range result.Names {
									methodInfo.Results = append(methodInfo.Results, ParameterInfo{
										Name: resultName.Name,
										Type: typeStr,
									})
								}
							} else {
								methodInfo.Results = append(methodInfo.Results, ParameterInfo{
									Type: typeStr,
								})
							}
						}
					}

					interfaceInfo.Methods = append(interfaceInfo.Methods, methodInfo)
				}
			}
		}
	}

	return interfaceInfo
}

func extractType(fset *token.FileSet, ts *ast.TypeSpec, doc *ast.CommentGroup) TypeInfo {
	typeInfo := TypeInfo{
		Name:       ts.Name.Name,
		Type:       exprToString(ts.Type),
		IsExported: ast.IsExported(ts.Name.Name),
	}

	if doc != nil {
		typeInfo.Doc = strings.TrimSpace(doc.Text())
	}

	return typeInfo
}

func extractConstant(fset *token.FileSet, name *ast.Ident, vs *ast.ValueSpec, doc *ast.CommentGroup) ConstantInfo {
	constInfo := ConstantInfo{
		Name:       name.Name,
		IsExported: ast.IsExported(name.Name),
	}

	if doc != nil {
		constInfo.Doc = strings.TrimSpace(doc.Text())
	}

	if vs.Type != nil {
		constInfo.Type = exprToString(vs.Type)
	}

	// Find the corresponding value
	for i, n := range vs.Names {
		if n == name && i < len(vs.Values) {
			constInfo.Value = exprToString(vs.Values[i])
			break
		}
	}

	return constInfo
}

func extractVariable(fset *token.FileSet, name *ast.Ident, vs *ast.ValueSpec, doc *ast.CommentGroup) VariableInfo {
	varInfo := VariableInfo{
		Name:       name.Name,
		IsExported: ast.IsExported(name.Name),
	}

	if doc != nil {
		varInfo.Doc = strings.TrimSpace(doc.Text())
	}

	if vs.Type != nil {
		varInfo.Type = exprToString(vs.Type)
	}

	// Find the corresponding value
	for i, n := range vs.Names {
		if n == name && i < len(vs.Values) {
			varInfo.Value = exprToString(vs.Values[i])
			break
		}
	}

	return varInfo
}

func extractTodo(comment string, line int) *TodoInfo {
	comment = strings.TrimSpace(comment)
	comment = strings.TrimPrefix(comment, "//")
	comment = strings.TrimPrefix(comment, "/*")
	comment = strings.TrimSuffix(comment, "*/")
	comment = strings.TrimSpace(comment)

	todoTypes := []string{"TODO", "FIXME", "HACK", "NOTE"}
	for _, todoType := range todoTypes {
		if strings.HasPrefix(strings.ToUpper(comment), todoType+":") {
			content := strings.TrimSpace(comment[len(todoType)+1:])
			return &TodoInfo{
				Type:    todoType,
				Content: content,
				Line:    line,
			}
		}
	}
	return nil
}

func exprToString(expr ast.Expr) string {
	switch e := expr.(type) {
	case *ast.Ident:
		return e.Name
	case *ast.StarExpr:
		return "*" + exprToString(e.X)
	case *ast.ArrayType:
		if e.Len == nil {
			return "[]" + exprToString(e.Elt)
		}
		return "[" + exprToString(e.Len) + "]" + exprToString(e.Elt)
	case *ast.MapType:
		return "map[" + exprToString(e.Key) + "]" + exprToString(e.Value)
	case *ast.ChanType:
		switch e.Dir {
		case ast.SEND:
			return "chan<- " + exprToString(e.Value)
		case ast.RECV:
			return "<-chan " + exprToString(e.Value)
		default:
			return "chan " + exprToString(e.Value)
		}
	case *ast.FuncType:
		return "func" // Simplified for now
	case *ast.InterfaceType:
		return "interface{}" // Simplified for now
	case *ast.StructType:
		return "struct{}" // Simplified for now
	case *ast.SelectorExpr:
		return exprToString(e.X) + "." + e.Sel.Name
	case *ast.BasicLit:
		return e.Value
	case *ast.ParenExpr:
		return "(" + exprToString(e.X) + ")"
	default:
		return "unknown"
	}
}