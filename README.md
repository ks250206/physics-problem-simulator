# PHYSICS LAB — 入試物理を、動かそう。

日本の大学入試に登場する力学・電磁気の設定を、保存則・運動方程式・糸の拘束条件から計算して動かす、ブラウザー上の3D実験室です。

**GitHub Pages URL:** https://ks250206.github.io/physics-problem-simulator/

> 公開にはリポジトリの **Settings → Pages → Source: GitHub Actions** が必要です。初回の有効化とAbout設定は `bash scripts/configure-repo.sh` でまとめて実行できます（管理権限のある `gh` 認証が必要）。ソースのpushとサイトの公開完了は別です。Actionsのdeployジョブの成功を確認してください。

[![Test and deploy](https://github.com/ks250206/physics-problem-simulator/actions/workflows/pages.yml/badge.svg)](https://github.com/ks250206/physics-problem-simulator/actions/workflows/pages.yml)

## できること

| 実験 | 変えられる条件 | 検証する物理 |
|---|---|---|
| 曲面台と小球 | 自由台／固定台、放物線・非対称・4次曲線、質量、初期位置・速度、落下高さ | 水平運動量、力学的エネルギー、接触時の衝突損失 |
| ばねと二物体 | 質量、ばね定数、初期伸び、重心速度 | 重心運動と相対単振動、換算質量、周期 |
| 導体棒と磁場 | 一定速度／磁気ブレーキ／一定外力、磁場の向き、抵抗、棒長 | 誘導起電力、電流、磁気抵抗力、仕事とジュール熱 |
| 滑車と糸 | 定滑車／動滑車／二段複合滑車、各おもりの質量 | 糸の長さ、加速度、張力、エネルギー |

3D回転・拡大、正面表示、速度／力の矢印、対象・重心追従、再生／一時停止／コマ送り、0.25〜2倍速、時刻スライダー、エネルギーグラフ、条件共有URL、CSV出力に対応。画面は日本語、スマートフォン対応。APIキー・バックエンドは不要です。

**操作:** ドラッグで回転、ホイール／ピンチで拡大。Spaceで再生・一時停止、Rで時刻をリセット。条件の変更は時刻0に戻ります。矢印と物体サイズは模式表示です。「重心追従」はカメラ移動で、速度・エネルギーの数値は実験室系です。

## 調査した大学公式資料

問題文・図は転載せず、典型設定を独自モデルとして実装しています。**各大学の入試問題を全条件まで完全再現するソフトではありません。** 出題意図しか確認していない資料と、設問図まで確認した資料を区別しています。

| 資料 | 確認した題材・本アプリとの関係 |
|---|---|
| [近畿大学 R6年度 過去問解説テキスト・物理 大問Ⅰ](https://kindai.jp/assets/pdf/hisyojuku/2024/physics.pdf) | 左右で半径の異なる円弧・水平面を持つ可動台。R6は公開教材の年度。実装は円弧でなく多項式曲面。 |
| [千葉大学 2019 先進科学プログラム 課題I-A・解答](https://www.cfs.chiba-u.ac.jp/admission/past/files/h31/H31-III/R01-III-answer-IAB.pdf) | ばねで分離する二物体、自由に動く曲面台。先進科学プログラム選考であり一般選抜とは区別。 |
| [東京都立大学 2025後期 出題意図](https://www.tmu.ac.jp/extra/download.html?d=assets%2Ffiles%2Fdownload%2Fentrance%2F33_ito_2025_kouki-rika-suugaku.pdf) | 物理第1問のばね二体系、第2問の磁場中の導体棒。題材は出題意図で確認。 |
| [中部大学 2023前期A/B・2月3日 理科](https://www.chubu.ac.jp/admissions/wp-content/uploads/sites/15/2023/07/admissions-entrance-exams-questions-2023zenkiAB0203-s.pdf) | 物理①・大問Ⅰ（冊子p295–296）、複数滑車・おもり・糸切断。アプリは別の一般化構成で切断なし。 |
| [名古屋工業大学 2026前期 理科・解答／出題意図](https://www.nitech.ac.jp/examination/mt_files/2026_zenki_rika_kaitou.pdf) | 滑車・糸・ばねの力学、電磁気の関連題材。組合せ系を丸ごと再現するものではない。 |
| [京都大学 2026年度 公開問題・出題意図](https://www.kyoto-u.ac.jp/ja/admissions/undergrad/past-eq/r8-eq) | 物理Ⅰの動く斜面と固定斜面。摩擦、複数斜面、荷電粒子の運動は未実装。 |

調査の詳細・発展候補は [docs/RESEARCH.md](docs/RESEARCH.md)、導出と検証方針は [docs/PHYSICS.md](docs/PHYSICS.md) を参照してください。原資料の権利は各権利者に帰属します。大学による公式アプリではありません。

## 技術構成・開発

**Node.js 26 / pnpm 12 / Vite+ 1.6 / React 19 / TypeScript / Three.js**。ViteはVite+のcoreパッケージにaliasし、`vp dev` / `vp build` を使用します。ツールチェーンはpackage.json・pnpm-workspace.yamlで定義。

```bash
# Node.js 26 を用意
npm install -g pnpm@12.19.0
pnpm install
pnpm dev
# http://localhost:5173/physics-problem-simulator/
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

初回CIは依存関係を解決してlockfileを生成し、検証成功後にbotが `pnpm-lock.yaml` をmainへ追加します。以降のCIは `--frozen-lockfile` で再現可能なインストールを行います。独自ドメインや別リポジトリで公開する場合は `vite.config.ts` の `base` を変更してください。

```
src/physics.ts   描画に依存しない計算核・衝突イベント・解析解
src/catalog.ts   日本語の実験設定・入力範囲・原資料リンク
src/world.ts     Three.jsの装置・小球・ばね・滑車・ベクトル
src/App.tsx      再生、パラメータ、グラフ、共有URL、CSV
tests/          物理の単体テスト・Playwrightブラウザーテスト
docs/           調査・導出・適用範囲
```

## 正確さと適用範囲

曲面上の相対運動をRK4（通常1/480秒）で積分し、自由台の位置・速度は水平運動量と重心から再構成します。落下から接触へのイベント時刻は二分探索で求め、法線衝撃量を反映。ばね二体系・導体棒・各滑車は解析解です。Three.jsは表示にのみ使い、汎用剛体エンジンには依存しません。

小球は回転しない質点、ばね・糸・滑車は質量なし。摩擦・空気抵抗・電気回路の自己インダクタンスは扱いません。接触時の反発係数は0。台からの飛び出しと滑車の衝突は計算範囲の終端で停止します。これは理想的な平面運動の3D可視化であり、任意の物体を組み立てる6自由度の物理サンドボックスではありません。

**収支:** `K + U + Q − W = E₀`。Qは散逸（衝突損失・ジュール熱）、Wは外力の仕事です。機械的エネルギーだけの保存を、衝突や抵抗のある系に誤適用しません。運動量を保存量として表示するのは自由台とばね二体系のみ。収支誤差は `|K+U+Q−W−E₀| / max(1 J, |E₀|)` です。

CSV座標はモデル依存です。曲面台はq=(台X, 小球x, 小球y)、ばねはq=(x₁,x₂)、導体棒はq=(初期位置からの変位x)、滑車はq=(各おもりの下向き座標)。vも対応する速度。詳細は計算核の型とドキュメントを参照。

## 検証と公開

単体テストは質量・形状・磁場・滑車構成を変えて、保存則、RK4収束、反発係数、ゼロ磁場極限、独立な数値積分によるジュール熱、糸の拘束、運動方程式を検証します。Playwrightは4シーン、各モード、再生・リセット、条件共有、CSV、スマートフォン幅を確認し、Actionsにスクリーンショットを保存します。

mainへのpushで **物理テスト → 型チェック → build → ブラウザーテスト → Pages deploy**。Pages初期設定が未完了の場合、build成果物は作れてもdeployは失敗します。その場合、上記の設定または `bash scripts/configure-repo.sh` を実行してください。このスクリプトはAbout（説明・Website・Topics）も設定します。認証トークンはリポジトリへ保存しないでください。
