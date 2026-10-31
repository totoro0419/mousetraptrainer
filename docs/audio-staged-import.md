# 音声ファイルの段階的取り込み（PR #11）

この文書は音声1,164件を少量ずつ検証して取り込むための手順です。**作業ブランチは PR #11 の `feature/integrated-audio-rehearsal-20261031` のみ**。全件検証までmainへマージしません。

## 元データと安全条件

- 元ZIP: `The_Mousetrap_Audio_For_App.zip`（32,873,703 bytes）。
- 元ZIP SHA-256: `eeb77658464532962888fdbfcf4bd5d382c125a89210f37d716f5b712a238533`。
- 正式な対応表: `dist/data/audio-manifest.json`（各セリフID・パス・サイズ・音声SHA-256）。
- 同時に取得した生成元ZIP: `Mousetrap_MP3_OneClick_READY.zip`。中の台本JSONのSHA-256は `c4bd5bcf1e0a225ade1bb860775a189e259c2977e971684ac6124558ad843230`。
- GitHub runnerから外部ChatGPTサイトを取得する方式は HTTP 403 で失敗するため廃止。**そのURLへの自動再試行は禁止**。代わりに元ZIPの原本確認後、ローカルで検証済みMP3を作業ブランチへ送る。
- 原本ZIPおよび生成元ZIPをGitHubへ丸ごとコミットしない。音声は `dist/audio/lines/...` に必要なMP3のみ配置。

## 採用した転送経路（段階1で実証）

**GitHub Releasesへの元ZIPアップロードは不要です。** ローカルで原ZIPと既存マニフェストをSHA-256照合し、GitHubのGit Data APIでMP3をbase64エンコードしたblobとして送信します。GitHubが返したblob SHAを元MP3からローカル計算したGit blob SHAと照合してから、**10件分を1つのtree・commitとして作業ブランチへ反映**します。直後にGitHub側のtreeを再取得して存在・サイズ・blob SHAを確認します。

1. `docs/audio-import-progress.json` の `nextBatch` と GitHub側の実ファイル数を照合。
2. 原ZIP内の対象ファイルのサイズ・SHA-256を `dist/data/audio-manifest.json` と照合。
3. 各ファイルをGit Data APIの `create_blob` に `encoding=base64` で送信。
4. ローカルで求めたGit blob SHAと返されたSHAが完全一致することを確認。
5. 既存treeを基準に対象blobを追加、progressを更新したcommitを作成、PR #11のbranchへfast-forward。
6. GitHub APIでtreeとprogressを読み直し、**登録成功を独立確認**。

音声の受け渡しに使った一時的なライブラリデータは完了後に整理し、GitHubには原ZIPを入れません。`.github/workflows/import-verified-audio.yml` は取り込みを行わず、PRブランチへ置かれた音声のSHA-256とチェックポイント整合性を検査します。未収録分を埋めるまでは `npm test` / `npm run build` の全件必須検査は成功しません。

**段階1実績:** 2026-10-31。第1場面の0001〜0010を登録。登録件数10、音声バイト合計351,216、残り1,154。コミット `6e8dde727de7f00d816f5315e61b3d53755f34bd` で元音声とGit blob SHAが一致し、GitHubリモートtreeで10件の存在・サイズを確認。次は0011から25件。

## バッチ投入

確認済みの作業コピーで、次のコマンドを実行します。各実行で自動的にZIPのSHA-256・CRC・全件ファイル名集合・対象MP3のサイズとSHA-256を確認します。既存ファイルは再配置せず、正しくないファイルが存在するとエラーで停止します。

```sh
python3 scripts/stage-audio-batch.py --status
python3 scripts/stage-audio-batch.py /path/to/The_Mousetrap_Audio_For_App.zip --start 1 --count 10
python3 scripts/stage-audio-batch.py --status
```

最初の10件は遠隔ブランチ上で確認済みです。次は11件目から25件、その後は最大50件ずつ進行します。ステータスの`next_start`を確認し、**追加MP3だけ**をPRブランチへコミットします。ハッシュが一致しないファイルは置換・強行せず原因を特定します。1バッチごとに `docs/audio-import-progress.json` を実際のリモート確認結果で更新します。

GitHubへMP3を転送するには、元ZIPを展開できる認証済みの作業環境からGit pushするか、検証済みバイト列をGitHub Git Data APIに渡す必要があります。**この2つはGitHub側に実ファイルが配置されるまで成功と見なさない**。ファイルを作業環境内に取り出しただけでは登録数に含めません。

## 検証と完了条件

1. 1バッチごとに`--status`でリモート作業コピーにある全MP3のSHA-256を確認する。再実行で新規ファイルが増えないことも確認する。
2. PR #11 は作業中のまま維持。全1,164件を揃えるまで`npm test`や`npm run build`の全件必須テストが失敗するのは想定内であり、失敗を隠すために検査を無効化しない。
3. 全件取り込み後、`node scripts/validate-audio.mjs`、`npm test`、`npm run build`、ブラウザ再生検証とGitHub Pages配信を確認する。
4. 全件の整合性を確認できた後に初めてPR #11をレビュー・マージする。

### 段階0での実測

原ZIPをユーザーのライブラリから再取得。SHA-256・ZIP CRC・MP3数1,164・場面別190/336/638・欠落/重複0件を確認。最初の10件はPRの音声マニフェストに記載されたサイズとSHA-256が一致した。

取り込みツールのローカルテストでは、0件状態、10件追加、同じ10件の再実行（追加0）、改変ファイルの拒否を確認。ただしこれは**隔離したテストコピー上の試験**であり、GitHubのMP3登録実績ではない。段階0終了時点で遠隔ブランチにMP3は0件。
