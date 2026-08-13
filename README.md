# Markun

Markun は、ローカルの Markdown 技術文書を読むことに特化したデスクトップアプリです。長い日本語文書、目次、表、引用、ネストされたコードブロックを、元ファイルを変更せずに表示します。

## 主な機能

- `.md` / `.markdown` の複数ファイル選択とドラッグ＆ドロップ
- フォルダーを渡すと配下のMarkdownをサイドバーに一覧表示（再帰。深さ5・200件・5,000項目を上限とし、ドット先頭のフォルダーとシンボリックリンクは辿りません）
- パーサーの構文木から作る目次
- Java、Groovy、properties などのコードハイライト
- コードのコピーと折り返し切り替え
- 文書内検索
- ライト、ダーク、OS連動の配色
- 本文サイズ調整
- 本文幅の標準／ワイド切り替え
- 最近開いたファイルと文書ごとのスクロール位置
- raw HTMLを無効化したオフライン表示

## 開発

Node.js と npm が必要です。

```powershell
npm install
npm run dev
```

ブラウザ開発画面では、OSネイティブダイアログの代わりにブラウザのファイル選択を使用します。

## テストとフロントエンドビルド

```powershell
npm test
npm run build
```

テスト環境に以下のサンプルファイルが存在する場合は、実ファイルを読み込んで見出し、表、コードブロックを検証します。期待値は原文から導出するため、サンプルの内容が更新されてもテストは追従します。

- `D:\MyProjects\java-practice\study\docs\phase5\ch51\java-ch51-basics.md`
- `D:\MyProjects\java-practice\study\docs\phase5\ch51\java-ch51-problems.md`

テストはファイルを読み取るだけで、内容を変更しません。

## デスクトップ実行

Tauri のWindows向け前提ツールとして、Rustのstable toolchain、Microsoft C++ Build Tools、WebView2が必要です。

```powershell
npm run tauri dev
```

インストーラーを生成する場合:

```powershell
npm run tauri build
```

生成物は `src-tauri\target\release\bundle\` に出力されます。

## キーボード

| 操作 | キー |
|---|---|
| ファイルを開く | `Ctrl+O` |
| フォルダーを開く | `Ctrl+Shift+O` |
| 文書内検索 | `Ctrl+F` |
| 再読込 | `Ctrl+R` |
| 現在のタブを閉じる | `Ctrl+W` |
| 次／前のタブ | `Ctrl+Tab` / `Ctrl+Shift+Tab` |

## セキュリティ

- raw HTMLは描画しません。
- 描画HTMLはDOMPurifyでサニタイズします。
- 外部リンクはHTTP(S)だけをOSの既定ブラウザで開きます。
- `..` を含む相対パスは拒否します。
- テレメトリーや文書の外部送信はありません。
