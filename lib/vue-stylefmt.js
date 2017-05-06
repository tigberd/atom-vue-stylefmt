'use babel'

import { CompositeDisposable } from 'atom'
import os from 'os'
import fs from 'fs'
import postcss from 'postcss'
import scss from 'postcss-scss'
import stylefmt from 'stylefmt'

let subscriptions
let editorObserver
let formatOnSave

export default {
  activate() {
    subscriptions = new CompositeDisposable()

    subscriptions.add(
      atom.config.observe('vue-stylefmt.formatOnSave', value => {
        formatOnSave = value
      })
    )

    editorObserver = atom.workspace.observeTextEditors(editor => {
      editor.getBuffer().onWillSave(() => {
        if (formatOnSave) {
          this.format(atom.workspace.getActiveTextEditor())
        }
      })
    })

    atom.commands.add(
      'atom-text-editor:not([mini])',
      'vue-stylefmt:format',
      () => {
        this.format(atom.workspace.getActiveTextEditor())
      }
    )
  },

  deactivate() {
    subscriptions.dispose()
    editorObserver.dispose()
  },

  format(editor) {
    if (!editor) {
      return atom.notifications.addWarning('[vue-stylefmt] Missing editor.', {
        detail: 'Failed to get the editor, Reboot Atom.',
        dismissable: true
      })
    }

    if (editor.getGrammar().name.toLowerCase() !== 'vue component') {
      return
    }

    const path = editor.getPath()
    const regex = /<style([\s\S]*?)>([\s\S]*?)<\/style>/

    const [_, attr, value] = regex.exec(editor.getText())
    const rand = Math.floor(Math.random() * 10000000)
    const tmpfile = `${os.tmpdir()}/vue-style${rand}.css`
    fs.writeFileSync(tmpfile, value)
    const options = {
      from: tmpfile
    }

    if (/scss/.test) {
      options.syntax = scss
    }

    postcss([stylefmt()])
      .process(value, options)
      .then(result => this.replaceCss(editor, result.css))
      .catch(error => atom.notifications.addError(error.toString(), {}))
  },

  replaceCss(editor, value) {
    const position = editor.getCursorBufferPosition()
    const formattedCss = editor.scan(
      /(<style[\s\S]*?>)[\s\S]*?(<\/style>)/g,
      iterator => {
        iterator.replace(`${iterator.match[1]}\n${value}${iterator.match[2]}`)
      }
    )

    editor.setCursorBufferPosition(position)
    return editor
  }
}
