var parse = require('chr/parse')
var compile = require('chr/compile')

module.exports = function (babel) {
  var t = babel.types

  var constructors = []
  var instances = {}
  var runtimeName = 'Runtime'

  return new babel.Transformer('chr', {
    'CallExpression|TaggedTemplateExpression': function (node, parent, scope, file) {
      var self = this

      if (t.isIdentifier(node.callee, { name: 'require' }) && node.arguments[0].value === 'chr') {
        // Found: "require('chr')"

        assign(parent, function (name) {
          constructors.push(name)
        })

        runtimeName = scope.generateUidIdentifier('Runtime').name

        this.parentPath.replaceWithSourceString(
          runtimeName + ' = require("chr/runtime")'
        )
      } else if ((node.type === 'CallExpression' && instances.hasOwnProperty(node.callee.name)) ||
        (node.type === 'TaggedTemplateExpression') && instances.hasOwnProperty(node.tag.name)) {
        // Found: "chr(...)"
        //    or: chr`...`

        var prefix = (node.type === 'CallExpression' ? node.callee.name : node.tag.name)
        var instance = instances[prefix]

        var chrSource
        if (node.type === 'CallExpression') {
          chrSource = node.arguments[0].value
        } else {
          chrSource = node.quasi.quasis.map(function (quasi) {
            return quasi.value.raw
          })
          var taggedChrSource = chrSource[0]

          var replacements = node.quasi.expressions
          replacements = replacements.map(function (expr, ix) {
            // new name for expr
            var exprId = scope.generateUidIdentifier('replacement' + ix).name
            var exprF
            if (t.isFunction(expr)) {
              exprF = t.functionExpression(t.identifier(exprId), [], t.blockStatement([
                t.returnStatement(t.callExpression(t.parenthesizedExpression(expr), []))
              ]))
            } else if (t.isIdentifier(expr) || t.isMemberExpression(expr)) {
              exprF = t.functionExpression(t.identifier(exprId), [], t.blockStatement([
                t.returnStatement(t.callExpression(expr, []))
              ]))
            } else {
              // BinaryExpression etc
              exprF = t.functionExpression(t.identifier(exprId), [], t.blockStatement([
                t.returnStatement(expr)
              ]))
            }
            self.insertAfter(exprF)

            var replacementId = instance.replacements
            taggedChrSource += '${' + replacementId + '}' + chrSource[ix + 1]
            instance.replacements += 1

            return 'chr.Replacements[' + replacementId + '] = ' + exprId + '.bind(chr)'
          })

          chrSource = taggedChrSource
        }

        var parts = ['']
        parts.push(
          prefix + ' = (function (chr) {'
        )

        var parsed = parse(chrSource)
        parsed.body.forEach(function (rule) {
          var head
          var functor
          var compiled

          parts.push(
            '/**',
            ' * [CHR Rule] ' + rule.original,
            ' */'
          )

          // add callers, e.g. 'chr.a = function() { ... }'
          rule.constraints.forEach(function (functor) {
            var name = functor.split('/')[0]
            if (!instance.constraintNames.hasOwnProperty(name)) {
              // not already defined
              parts.push('chr.' + name + ' = ' + runtimeName + '.Helper.dynamicCaller("' + name + '")')
              instance.constraintNames[name] = true
            }

            if (!instance.constraints.hasOwnProperty(functor)) {
              parts.push('chr.Constraints["' + functor + '"] = []')
              instance.constraints[functor] = 0
            }
          })

          // add replacements, e.g. 'chr.Replacements[0] = function() { ... }'
          ;['guard', 'body'].forEach(function (location) {
            rule[location] = rule[location].map(function (element) {
              if (element.type !== 'Replacement' || !element.hasOwnProperty('original')) {
                return element
              }

              var src = element.original
              if (location === 'guard') {
                src = 'return ' + src
              }

              var replacementId = instance.replacements
              parts.push('chr.Replacements[' + replacementId + '] = function() {' + src + '}')

              var newElement = {
                type: 'Replacement',
                num: replacementId
              }
              return newElement
            })
          })

          // add occurences
          for (var headNo = rule.head.length - 1; headNo >= 0; headNo--) {
            head = rule.head[headNo]
            functor = head.name + '/' + head.arity

            compiled = compile.head(rule, headNo, {
              helper: runtimeName + '.Helper'
            })

            var occurenceNumber = instance.constraints[functor]
            parts.push('chr.Constraints["' + functor + '"][' + occurenceNumber + '] = function (constraint) {')
            parts = parts.concat(compiled)
            parts.push('}')
            instance.constraints[functor] += 1
          }

          parts.push('')
        })

        parts = parts.concat(replacements)

        parts.push(
          'return chr',
          '})(' + prefix + ')'
        )

        this.replaceWithSourceString(parts.join('\n'))
      }
    },
    NewExpression: function (node, parent, scope, file) {
      if (constructors.indexOf(node.callee.name) === -1) {
        return
      }

      assign(parent, function (name) {
        instances[name] = newInstance(name)
      })

      this.replaceWithSourceString([
        '{',
        'Store: new ' + runtimeName + '.Store(),',
        'History: new ' + runtimeName + '.History(),',
        'Constraints: {},',
        'Replacements: []',
        '}'
      ].join('\n'))
    }
  })
}

function assign (node, cb) {
  if (node.type === 'VariableDeclarator') {
    cb(node.id.name)
    return
  }

  if (node.type === 'AssignmentExpression') {
    cb(node.left.name)
    return
  }
}

function newInstance (name) {
  return {
    constraints: {},
    constraintNames: {},
    replacements: 0
  }
}
