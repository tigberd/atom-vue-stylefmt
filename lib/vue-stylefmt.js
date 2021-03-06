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
let replaceLocked = false

export function activate() {
  subscriptions = new CompositeDisposable()

  subscriptions.add(
    atom.config.observe('vue-stylefmt.formatOnSave', value => {
      formatOnSave = value
    })
  )

  atom.workspace.observeTextEditors(editor => {
    editor.getBuffer().onWillSave(() => {
      if (formatOnSave) {
        format(atom.workspace.getActiveTextEditor())
      }
    })
  })

  atom.commands.add(
    'atom-text-editor:not([mini])',
    'vue-stylefmt:format',
    () => {
      format(atom.workspace.getActiveTextEditor())
    }
  )
}

export function deactivate() {
  subscriptions.dispose()
  editorObserver.dispose()
}

export function format(editor) {
  if (canFormat(editor)) {
    formatCss(editor)
  }
}

function formatCss(editor) {
  let promises = []
  let position
  editor.backwardsScanInBufferRange(
    /(<style[\s\S]*?>)([\s\S]*?)(<\/style>)/g,
    editor.getBuffer().getRange(),
    async match => {
      const rand = Math.floor(Math.random() * 10000000)
      const tmpfile = `${os.tmpdir()}/vue-style${rand}.css`
      fs.writeFileSync(tmpfile, match.match[2])
      const options = {
        from: tmpfile
      }

      if (/scss/.test(match.match[1])) {
        options.syntax = scss
      }

      // postcssがpromiseで実行されるためreplaceが実行される順序を保証する
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
      while (true) {
        await sleep(50)
        if (replaceLocked === false) {
          break
        }
      }

      replaceLocked = true
      postcss([stylefmt()]).process(match.match[2], options).then(result => {
        position = editor.getCursorBufferPosition()
        match.replace(
          `${match.match[1].trim()}\n${result.css.trim()}\n${match.match[3].trim()}`.replace(
            /\n+/g,
            '\n'
          )
        )
        replaceLocked = false
        editor.setCursorBufferPosition(position)

        // replaceが非同期で走るのでreplace済みか確認しつつsaveを複数回行うことで対処する
        if (match.match[2].trim() !== result.css.trim()) {
          editor.getBuffer().save()
        }
      })
    }
  )

  return editor
}

function canFormat(editor) {
  if (!editor) {
    atom.notifications.addWarning('[vue-stylefmt] Missing editor.', {
      detail: 'Failed to get the editor, Reboot Atom.',
      dismissable: true
    })
    return false
  }

  if (editor.getGrammar().name.toLowerCase() !== 'vue component') {
    return false
  }
  return true
}
