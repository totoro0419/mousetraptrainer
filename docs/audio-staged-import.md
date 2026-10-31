# 音声ファイルの段階的取り込み（PR #11）

この文書は音声1,164件を少量ずつ検証して取り込むための手順です。**作業ブランチは PR #11 の `feature/integrated-audio-rehearsal-20261031` のみ**。全件検証までmainへマージしません。

## 元データと安全条件

- 元ZIP: `The_Mousetrap_Audio_For_App.zip`（32,873,703 bytes）。
- 元ZIP SHA-256: `eeb77658464532962888fdbfcf4bd5d382c125a89210f37d716f5b712a238533`。
- 正式な対応表: `dist/data/audio-manifest.json`（各セリフID・パス・サイズ・音声SHA-256）。
- 同時に取得した生成元ZIP: `Mousetrap_MP3_OneClick_READY.zip`。中の台本JSONのSHA-256は `c4bd5bcf1e0a225ade1bb860775a189e259c2977e971684ac6124558ad843230`。
- GitHub runnerから外部ChatGPTサイトを取得する方式は HTTP 403 で失敗するため廃止。**そのURLへの自動再試行は禁止**。代わりに元ZIPの原本確認後、ローカルで検証済みMP3を作業ブランチへ送る。
- 原本ZIPおよび生成元ZIPをGitHubへ丸ごとコミットしない。音声は `dist/audio/lines/...` に必要なMP3のみ配置。

## GitHub Actions での分割取り込み（推奨）

GitHub接続経由では現状、作業環境にある32MBのZIPを直接GitHubのバイナリ保存先へ転送できないため、**最初の1回だけ**GitHub Releasesに元ZIPをアップロードする方式に変更しました。

1. 本リポジトリの「Releases → Draft a new release」でタグ `audio-source-2026-10-31` のリリースを用意します。
2. `The_Mousetrap_Audio_For_App.zip` を**ファイル名を変えずに**アセットとして添付し、リリースを公開します。公開リポジトリなのでこのZIPも公開されます。
3. 次のバッチ開始時に `docs/audio-import-progress.json` をGitHub上で更新すると `.github/workflows/import-verified-audio.yml` が実行されます。スクリプトはReleaseからZIPを取得し、SHA-256・CRCと対象MP3ハッシュを確認してから、`nextBatch`指定件数のみPR #11ブランチにコミットします。
4. Actionが進捗JSONを実登録数で更新し、次に追加すべき先頭IDと件数を記録します。Actionsボットによるコミットで同じ処理が無限再起動することはありません。
5. リリースアセット未配置の場合は通知のみで終了し、ブランチやデータを変更しません。ZIPが置かれた後も、次のチェックポイント更新まで勝手に取り込みを開始しません。

これは音声データをローカルに展開してGit pushする代替経路です。**リリースへのアップロードと初回のGitHub上の取り込みは段階0ではまだ未実施**です。

## バッチ投入

確認済みの作業コピーで、次のコマンドを実行します。各実行で自動的にZIPのSHA-256・CRC・全件ファイル名集合・対象MP3のサイズとSHA-256を確認します。既存ファイルは再配置せず、正しくないファイルが存在するとエラーで停止します。

```sh
python3 scripts/stage-audio-batch.py --status
python3 scripts/stage-audio-batch.py /path/to/The_Mousetrap_Audio_For_App.zip --start 1 --count 10
python3 scripts/stage-audio-batch.py --status
```

初回10件が遠隔ブランチ上に存在し、正しく取得できることを検証してから次へ進みます。次は11件目から25件、その後は最大50件ずつ進行します。ステータスの`next_start`を確認し、**追加MP3だけ**をPRブランチへコミットします。ハッシュが一致しないファイルは置換・強行せず原因を特定します。1バッチごとに `docs/audio-import-progress.json` を実際のリモート確認結果で更新します。

GitHubへMP3を転送するには、元ZIPを展開できる認証済みの作業環境からGit pushするか、検証済みバイト列をGitHub Git Data APIに渡す必要があります。**この2つはGitHub側に実ファイルが配置されるまで成功と見なさない**。ファイルを作業環境内に取り出しただけでは登録数に含めません。

## 検証と完了条件

1. 1バッチごとに`--status`でリモート作業コピーにある全MP3のSHA-256を確認する。再実行で新規ファイルが増えないことも確認する。
2. PR #11 は作業中のまま維持。全1,164件を揃えるまで`npm test`や`npm run build`の全件必須テストが失敗するのは想定内であり、失敗を隠すために検査を無効化しない。
3. 全件取り込み後、`node scripts/validate-audio.mjs`、`npm test`、`npm run build`、ブラウザ再生検証とGitHub Pages配信を確認する。
4. 全件の整合性を確認できた後に初めてPR #11をレビュー・マージする。

### 段階0での実測

原ZIPをユーザーのライブラリから再取得。SHA-256・ZIP CRC・MP3数1,164・場面別190/336/638・欠落/重複0件を確認。最初の10件はPRの音声マニフェストに記載されたサイズとSHA-256が一致した。

取り込みツールのローカルテストでは、0件状態、10件追加、同じ10件の再実行（追加0）、改変ファイルの拒否を確認。ただしこれは**隔離したテストコピー上の試験**であり、GitHubのMP3登録実績ではない。段階0終了時点で遠隔ブランチにMP3は0件。
