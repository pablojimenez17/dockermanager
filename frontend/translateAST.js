import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
import * as t from '@babel/types';

// The babel packages expose default exports weirdly in ES modules
const traverse = _traverse.default || _traverse;
const generate = _generate.default || _generate;

const SRC_DIR = path.join(process.cwd(), 'src');
const EN_LOCALE_PATH = path.join(SRC_DIR, 'locales', 'en.json');
const ES_LOCALE_PATH = path.join(SRC_DIR, 'locales', 'es.json');

let enDict = {};
let esDict = {};

if (fs.existsSync(EN_LOCALE_PATH)) {
    enDict = JSON.parse(fs.readFileSync(EN_LOCALE_PATH, 'utf-8'));
}
if (fs.existsSync(ES_LOCALE_PATH)) {
    esDict = JSON.parse(fs.readFileSync(ES_LOCALE_PATH, 'utf-8'));
}

// Ensure global objects exist
if (!enDict.auto) enDict.auto = {};
if (!esDict.auto) esDict.auto = {};

function generateKey(text) {
    const clean = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 40);
    return clean || 'text_' + Math.floor(Math.random() * 10000);
}

function processFile(filePath) {
    if (filePath.includes('i18n.js') || filePath.includes('main.jsx') || filePath.includes('App.jsx')) return;
    
    console.log('Processing:', filePath);
    const code = fs.readFileSync(filePath, 'utf-8');
    
    let ast;
    try {
        ast = parse(code, {
            sourceType: 'module',
            plugins: ['jsx']
        });
    } catch (e) {
        console.error('Failed to parse', filePath, e.message);
        return;
    }

    let needsTranslation = false;
    let hasUseTranslationImport = false;
    let mainFunctionBody = null;

    traverse(ast, {
        ImportDeclaration(path) {
            if (path.node.source.value === 'react-i18next') {
                path.node.specifiers.forEach(spec => {
                    if (spec.imported && spec.imported.name === 'useTranslation') {
                        hasUseTranslationImport = true;
                    }
                });
            }
        },
        FunctionDeclaration(path) {
            // Find the main component function (heuristic: returns JSX)
            let returnsJSX = false;
            path.traverse({
                ReturnStatement(retPath) {
                    if (retPath.node.argument && (retPath.node.argument.type === 'JSXElement' || retPath.node.argument.type === 'JSXFragment')) {
                        returnsJSX = true;
                    }
                }
            });
            if (returnsJSX && !mainFunctionBody) {
                mainFunctionBody = path.node.body;
            }
        },
        VariableDeclarator(path) {
            // Check for arrow function components
            if (path.node.init && (path.node.init.type === 'ArrowFunctionExpression' || path.node.init.type === 'FunctionExpression')) {
                let returnsJSX = false;
                if (path.node.init.body.type === 'JSXElement' || path.node.init.body.type === 'JSXFragment') {
                    returnsJSX = true;
                    // Need to wrap in block statement to insert hook
                    const returnStmt = t.returnStatement(path.node.init.body);
                    path.node.init.body = t.blockStatement([returnStmt]);
                    mainFunctionBody = path.node.init.body;
                } else if (path.node.init.body.type === 'BlockStatement') {
                    path.traverse({
                        ReturnStatement(retPath) {
                            if (retPath.node.argument && (retPath.node.argument.type === 'JSXElement' || retPath.node.argument.type === 'JSXFragment')) {
                                returnsJSX = true;
                            }
                        }
                    });
                    if (returnsJSX && !mainFunctionBody) {
                        mainFunctionBody = path.node.init.body;
                    }
                }
            }
        },
        JSXText(path) {
            const text = path.node.value;
            if (text.trim().length > 0) {
                const trimmed = text.trim();
                // Avoid translating purely symbolic texts
                if (/^[^\w]+$/.test(trimmed)) return;
                
                const key = generateKey(trimmed);
                enDict.auto[key] = trimmed;
                esDict.auto[key] = `[ES] ${trimmed}`; // Placeholder for manual translation later or just visual check
                
                const translationCall = t.jsxExpressionContainer(
                    t.callExpression(t.identifier('t'), [t.stringLiteral(`auto.${key}`)])
                );
                
                // Replace text node, retaining whitespace around it if necessary
                const startSpace = text.match(/^\s*/)[0];
                const endSpace = text.match(/\s*$/)[0];
                
                const nodes = [];
                if (startSpace) nodes.push(t.jsxText(startSpace));
                nodes.push(translationCall);
                if (endSpace) nodes.push(t.jsxText(endSpace));
                
                path.replaceWithMultiple(nodes);
                needsTranslation = true;
            }
        },
        JSXAttribute(path) {
            const name = path.node.name.name;
            if (['placeholder', 'title', 'alt', 'label'].includes(name) && path.node.value && path.node.value.type === 'StringLiteral') {
                const text = path.node.value.value;
                if (text.trim().length > 0) {
                    const key = generateKey(text);
                    enDict.auto[key] = text;
                    esDict.auto[key] = `[ES] ${text}`;
                    
                    path.node.value = t.jsxExpressionContainer(
                        t.callExpression(t.identifier('t'), [t.stringLiteral(`auto.${key}`)])
                    );
                    needsTranslation = true;
                }
            }
        }
    });

    if (needsTranslation) {
        // Insert import
        if (!hasUseTranslationImport) {
            const importDecl = t.importDeclaration(
                [t.importSpecifier(t.identifier('useTranslation'), t.identifier('useTranslation'))],
                t.stringLiteral('react-i18next')
            );
            ast.program.body.unshift(importDecl);
        }

        // Insert hook into main component
        if (mainFunctionBody && mainFunctionBody.type === 'BlockStatement') {
            // Check if useTranslation is already called
            let hasHookCall = false;
            mainFunctionBody.body.forEach(stmt => {
                if (stmt.type === 'VariableDeclaration') {
                    stmt.declarations.forEach(decl => {
                        if (decl.init && decl.init.type === 'CallExpression' && decl.init.callee.name === 'useTranslation') {
                            hasHookCall = true;
                        }
                    });
                }
            });

            if (!hasHookCall) {
                const hookCall = t.variableDeclaration('const', [
                    t.variableDeclarator(
                        t.objectPattern([t.objectProperty(t.identifier('t'), t.identifier('t'), false, true)]),
                        t.callExpression(t.identifier('useTranslation'), [])
                    )
                ]);
                mainFunctionBody.body.unshift(hookCall);
            }
        }

        const output = generate(ast, { retainLines: true }, code);
        fs.writeFileSync(filePath, output.code, 'utf-8');
        console.log('Modified:', filePath);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            processFile(fullPath);
        }
    }
}

console.log('Starting translation extraction...');
walkDir(path.join(SRC_DIR, 'pages'));
walkDir(path.join(SRC_DIR, 'components'));

fs.writeFileSync(EN_LOCALE_PATH, JSON.stringify(enDict, null, 2), 'utf-8');
fs.writeFileSync(ES_LOCALE_PATH, JSON.stringify(esDict, null, 2), 'utf-8');
console.log('Done.');
