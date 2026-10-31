# 同梱英語音声と録音の追加

提供済み `The_Mousetrap_Audio_For_App.zip` から全1,164 MP3を `dist/audio/lines/` に収録。3場面は190 / 336 / 638件。MP3、24kHz、モノラル、合計32,496,480 bytes、5,416.080秒。元のTTS生成速度は+24%。アプリの1×は提供音声のそのままの速度です。

## 対応の根拠

音声ZIP単体には発話本文がありません。そこで生成元 `Mousetrap_MP3_OneClick_READY.zip` の `data/mousetrap_script_data.json` を独立取得し、アプリの `mousetrap.json` のscript全体と、本文・話者・ID・ordinal・順序が完全一致することを確認しました。生成器はこれらを検証してから各本文と話者別voice/pitchをTTSへ渡します。提供音声ZIPのJSONマップとJSインデックスも全件一致しています。名前や配列順だけでの推定対応ではありません。

元音声ZIPのSHA-256: `eeb77658464532962888fdbfcf4bd5d382c125a89210f37d716f5b712a238533`。
生成元台本JSONのSHA-256: `c4bd5bcf1e0a225ade1bb860775a189e259c2977e971684ac6124558ad843230`。
台本ID・話者・本文のruntime fingerprint: `7704be159524eedd2c32bd9b3c6cfc29cb18e2d7b498ec6fbfa8ce041d026f5f`。

`dist/data/audio-manifest.json` は全件のID、話者、場面、順序、本文ハッシュ、ファイルハッシュ、サイズ、再生時間、デコード時間、RMSを記録しています。ブラウザーでも台本の全文fingerprintを照合し、同じIDを再利用した改変台本へは配信音声を結合しません。

`python3 scripts/import-audio.py AUDIO_ZIP GENERATOR_SOURCE_JSON` で元資料から再検査・作成できます。ZIPのCRC、全件ffprobe、全件ffmpeg完全デコード、PCMのRMS、内容ハッシュの重複を調べます。デコード失敗・無音・未対応は0。同一音声4件は同一本文同士であり、異なる本文に同じ音声を割り当てた例は0です。

**未検証**: 全1,164ファイルの独立した聞き起こし・人による全件聴取。生成元との照合は意図された本文と話者設定の根拠であり、全件の発音・抑揚・演技品質が正しいことの証明ではありません。

## 再生と保存

単一のHTMLAudioElementを再利用し、現在のセリフと次の1件だけを遅延取得します。台本の各行へ再生ボタンを並べません。文章詳細に再生・停止・前後・再再生があり、速度、連続再生、自動追従、シークは展開して使います。手動スクロールで追従を解除します。非表示タブでは停止し、復帰後は明示的に再開します。

1つのAudioSessionが台本と練習を所有し、重複再生を防ぎます。古い取得・再生コールバックは世代番号で無効化。再生制限と通信・デコード失敗を表示し、再試行・手動進行を残します。音声を再開する際には保存した秒数へ戻り、データ切替時には以前の音声状態を破棄します。

PWAはシェルと小さなマニフェストのみ事前保存。音声は利用時に完全レスポンスを別cacheへ保存し、最大40ファイルに制限します。部分Rangeリクエストは保存済み完全ファイルから206を作り、部分ファイルを完全ファイルとして保存しません。保存されていない音声は通信が必要です。ブラウザーによるcache削除・容量制限はあり得ます。

GitHub Pagesのサブパスはimport.meta.urlに対する相対URLで解決します。全配信物は約36MiBで、[GitHub Pagesの1GB制限](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)以内です。自動再生の失敗は[HTMLMediaElement.play](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)のrejectとして扱います。

## 追加の録音


1. アプリの「設定 → 録音ファイル → 音声を追加」を開きます。
2. ファイル名を `act1-scene1-speech-0001.mp3` のように発話IDと一致させます。
3. 複数の音声を選択し、対応する発話数を確認して保存します。

登録済み音声はこのブラウザーのIndexedDBに保存され、オフラインで使えます。端末を移す場合は音声ファイルも再度読み込んでください。学習バックアップに音声本体は含みません。音声のない発話は「音声未登録」と表示し、自動再生されたことにはしません。

## 任意のファイル名／長い録音の区間

次のJSONを音声ファイルと同時に選択します。start / end は秒です。end は省略可能です。全発話を1ファイルに録音してから区間で対応付けることもできます。

```json
{
  "version": 1,
  "clips": {
    "act1-scene1-speech-0001": {"file": "scene-one.mp3", "start": 0, "end": 21.4},
    "act1-scene1-speech-0002": {"file": "scene-one.mp3", "start": 21.4, "end": 27.8},
    "act1-scene1-speech-0003": "giles-first-line.mp3"
  }
}
```

対応形式: MP3 / M4A / OGG / WAV / WebM / AAC / FLAC（ブラウザー側のデコーダーにも依存）。1ファイル100MB、合計500MB以内。対応しない発話ID、欠落ファイル、不正な区間は保存前にエラーを表示します。再生失敗・自動再生制限は画面に表示し、手動進行と再試行を残します。背景に移動すると再生を止め、復帰後は明示的に再開します。

## 将来の音声認識

`dist/modules/session.js` はDOMや音声APIから独立した状態遷移です。認識結果から `reveal` / `next` を直接自動実行せず、利用者に結果を確認させる層を追加してください。タップ進行を引き続き提供し、認識結果や一致率を暗記済み状態と混同しないでください。
