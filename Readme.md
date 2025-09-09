## js開発ディレクトリビューサーバ

viteなどで開発のディレクトリ内部の実行をiframeで表示させます。
port 3000 使用
### usage:
iframe右下の●で、ディレクトリを移動

以下でアクセス
```
http://localhost:3000
```
#### 表示について
フォルダ一覧でそのフォルダの中の dist ディレクトリを表示する。(vite対応)
distがない場合そのフォルダの_index.htmlを表示
それ以外はフォルダ内のファイル一覧表示

### install:
一覧を見たいディレクトリにserver.js package.json 配置して以下実行
```
node server.js
```
expressがない場合、以下実行
```
bash > npm install express
```

表示させたくないディレクトリは、ソースの配列にファイル名追加
```
// 除外したいディレクトリ名
const EXCLUDES = new Set([".git", ".deleted"]);
```

#### logについて
以下ファイルがlog パーミッションがない場合serveが起動エラー
```
/var/log/distviewer.log
```

Vagrantfileにポート解放追加
```
config.vm.network "forwarded_port", guest: 3000, host: 3000, host_ip: "0.0.0.0"
```
Vagrantfileの終わりに以下追加
```
config.vm.provision "shell", run: "always", inline: <<-SHELL
  /dockerd/start-distviewer.sh
SHELL
```
