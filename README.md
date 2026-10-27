# Stelle

[English](README.en.md)

**Stelle（ステラ）** は、[Cerune](https://github.com/Cerune-Lang/Cerune) で書かれた小さな**対話式 CLI RPG** です。ゲームのルールは Cerune 側に実装しており、同じ処理を Rust で重複実装していません。

現在は、戦闘デモと第1章のストーリープレビューをそれぞれ実行できます。

## ブラウザで遊ぶ（2D プレビュー）

**Windows の PowerShell でも操作できます。** 既存の Cerune の `world.ceru` が移動・イベント・状態遷移を担当し、ブラウザは2D描画とキー入力のみを担当します。現在はローカル用の Python HTTP サーバーから Cerune をパイプで起動する方式です。独立した配布用ゲームアプリや WebAssembly 版ではありません。

Stelle のリポジトリ直下で、Cerune と Python 3 を用意して実行してください。

```powershell
python browser/server.py --binary cerune --port 8765
```

ブラウザで <http://127.0.0.1:8765/> を開きます。**村の2Dマップを画面全体に表示**し、右上の「メニュー」に操作説明とオプションをまとめています。**矢印キー / WASD** を押し続けると8方向に連続移動（斜め移動可能）、**E / Space** で調査・会話、**R** で確認後に最初からやり直します。会話は画面下に表示し、不要になれば閉じられます。メニューから全画面表示や画面上の操作ボタンの表示も選べます。サーバーの終了はターミナルで Ctrl+C です。

現状、リュナは開始地点から調べます。ゲームの台詞はこの2D画面向けの表示文であり、ストーリーや進行条件は `src/world.ceru` の既存ルールから変更していません。ブラウザからの操作はローカルの Cerune プロセスへ送られます。**公開ネットワーク向けのサーバーではありません。**

```sh
python3 scripts/check_browser.py --binary cerune
```

このテストは Cerune の実体を使い、ブリッジの初期フレーム、移動、謎解き完了、リセット、不正入力を確認します。ブラウザ表示の見た目そのものは手動で確認してください。

## 実行方法

最新の [Cerune](https://github.com/Cerune-Lang/Cerune) をビルドするか、インストールしてください。

### 戦闘デモ

```sh
cerune check src/main.ceru
cerune run src/main.ceru
```

`1` で攻撃、`2` で回復、`3` で逃走します。無効な入力では戦闘ターンが進みません。勝利・敗北・逃走・入力終了（EOF）のいずれかで戦闘を終了します。入力待ちの前には、プロンプトを明示的にフラッシュしています。

**入力環境の制限：** Cerune の `std:io::read_line` は、Linux のターミナル、および Windows/Linux のファイルやパイプからの入力に対応しています。一方、**Windows の PowerShell・コンソールからの直接入力には、現時点では対応していません。** 対話操作には Linux または WSL を使用してください。Windows ではファイルから入力する方法もあります。たとえば PowerShell では、次のように実行できます。

```powershell
"1`n1`n1" | Set-Content -Encoding utf8 commands.txt
cmd /c "cerune run src/main.ceru < commands.txt"
```

従来の非対話式デモは、次のコマンドで実行できます。

```sh
cerune run src/demo.ceru
```

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `src/battle.ceru` | 戦闘ルールと純粋な状態遷移 `advance(state, action) -> Turn`、従来の表示用ラッパー |
| `src/main.ceru` | 標準入力を使う対話式の戦闘ループ |
| `src/demo.ceru` | スクリプトによる戦闘デモ |
| `src/engine_checks.ceru` | 戦闘状態の遷移チェック |
| `scripts/check_engine.py` | 戦闘の状態遷移を複数の実行方式で比較するテスト |
| `scripts/check_interactive.py` | 4つの実行方式に対する8種類の入力シナリオのテスト |
| `src/world.ceru` | 第1章のワールド状態、移動・調査ルール、マップのタイル表示 |
| `src/chapter1.ceru` | 第1章の文章表示とターミナル入力 |
| `src/world_checks.ceru` | ワールド状態の遷移チェック |
| `scripts/check_chapter1.py` | 第1章のシナリオとワールドの回帰テスト |

現在のエンジンは、汎用フレームワークではなく Stelle 専用の小さな基盤です。ダメージ、回復アイテム、敵のターン処理を書き換えずに、入力方法や UI を変更できる構造になっています。

## テスト

```sh
python3 scripts/check_engine.py --binary cerune
python3 scripts/check_interactive.py --binary cerune
```

対話式戦闘のテストは、Windows のコンソール入力ではなく、パイプ経由で入力バイト列を送ります。勝利・逃走・不正な操作・回復・回復アイテムの枯渇・敗北・CRLF・改行のない最終行・EOF を検証します。CI ではテストに先立って Cerune をビルドします。

## 第1章：橋のない村（プレビュー）

戦闘デモとは別に、第1章「The Village Without a Bridge」の短いストーリープレビューを遊べます。

```sh
cerune run src/chapter1.ceru
```

`w` / `a` / `s` / `d` で移動、`e` で現在地を調査、`q` で終了します。各コマンドを入力したら Enter を押してください。マップ上の `@` は主人公の位置です。

開始地点でリュナ（Lyuna）に話しかけて星のランタンを受け取り、森に隠れた星の欠片を見つけ、ビーコンを再起動します。橋を復元したら渡り、家の中にある日記を読んでください。**このプレビューには、まだ戦闘はありません。**

ワールドのルールとマップ表示は `src/world.ceru` に、文章表示と入力処理は `src/chapter1.ceru` に分かれています。将来 2D 描画に切り替える場合も、同じワールド状態を使い、謎解きルールを二重に実装しないことを意図しています。

```sh
python3 scripts/check_chapter1.py --binary cerune
```

実際のターミナルから対話操作するには、現行の Cerune の標準入力仕様上、Linux または Linux 版 Cerune を使用する WSL が必要です。Windows のネイティブコンソールからの直接入力には対応していません。

**言語について：** この README は日本語ですが、現時点のゲーム内表示テキストは英語です。ゲーム本文の日本語化は別の変更として扱います。
