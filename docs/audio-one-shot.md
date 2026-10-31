# The Mousetrap — 音声一括導入（1回アップロード方式）

この手順が現在の推奨方式です。**10件・25件・50件ずつの転送は不要です。**

## ユーザーの操作（1回）

1. https://github.com/totoro0419/mousetraptrainer/releases/new を開く。
2. 新しいタグ名を `audio-source-2026-10-31` にする。リリース対象は `main` のままでよい。
3. `The_Mousetrap_Audio_For_App.zip`（32,873,703 bytes）を「Attach binaries」へ添付する。ZIPの名前は変えない。
4. リリースを公開する（パブリックリポジトリのためZIPも公開される）。その後、ChatGPTへ「アップ完了」と連絡する。

## 以降の自動処理

ChatGPT側でPR #11のブランチに `docs/audio-import-request.json` を作成するだけで `.github/workflows/import-full-release-audio.yml` が実行される。

ActionsがZIPを取得し、`scripts/import-full-audio.py` でSHA-256・ZIP CRC・発話IDの対応・1,164件のファイルハッシュを検査する。既存の10件は同一性確認のみ行い、欠けている1,154件をまとめて展開する。`npm test` と `npm run build` の両方が成功した場合に限り、PR #11の作業ブランチへ全MP3と進捗をコミットする。公開用 `main` へは自動マージしない。

### 元ZIPの識別情報
- ZIP SHA-256: `eeb77658464532962888fdbfcf4bd5d382c125a89210f37d716f5b712a238533`
- 合計音声数: 1,164
- 合計MP3バイト数: 32,496,480
- 完了までのユーザー操作: リリースZIPを1回アップロード、完了連絡1回

**注意:** リリース未作成、転送未実行、全件テスト未実行の現時点では「一括取り込み完成」と判定しない。
