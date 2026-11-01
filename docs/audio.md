# GitHubへの音声配置と公開

音声は利用者がアプリ内からインポートするのではなく、開発者がGitHubに配置し、公開アプリから再生します。

## 追加するファイル

GitHubリポジトリ `totoro0419/mousetraptrainer` の `audio-packs/` に、
次の2ファイルを**解凍せずそのまま**追加します。

- `mousetrap-audio-act1.zip` — Act 1 の526件
- `mousetrap-audio-act2.zip` — Act 2 の638件

元の `The_Mousetrap_Audio_For_App.zip` はGitHubブラウザーの1ファイル上限を超えるため、
25 MiB以下の2つに分割したファイルを使います。

1. GitHubで `https://github.com/totoro0419/mousetraptrainer` を開く。
2. `audio-packs/` フォルダーに2つのZIPをアップロードする（なければ新規作成して追加）。
3. mainへ反映する。GitHub Actions「Publish GitHub Pages」が自動実行される。
4. Actionsが成功したら `https://totoro0419.github.io/mousetraptrainer/audio/index.json` を確認する。
5. アプリの「練習 → 音声練習」を開き、相手役のセリフを再生する。

## 公開の仕組み

`scripts/install-audio.py` が両ZIPを読み込み、ZIPの破損、パス、重複、
各場面の連番と1,164件の総数を検査して `dist/audio/lines/` へ展開します。
`dist/audio/index.json` は発話IDから音声ファイルへの対応表です。
ZIPを片方だけ追加しても不完全な音声は公開されません。

GitHub Pagesのビルド時に展開するため、展開済みMP3を1,164個Gitに直接追加する必要はありません。
アプリは必要な音声をネットワークから取得し、再生済みファイルは端末側にキャッシュされます。
音声を最初から全件オフラインで利用できることは保証しません。

## 注意

公開リポジトリにアップロードする音声は、アクセスした第三者が取得できます。
録音や原作の公開権限があることを確認してから追加してください。
