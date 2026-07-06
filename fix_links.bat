@echo off
rmdir "g:\test\Nest\english\server\node_modules\alipay-sdk" 2>nul
rmdir "g:\test\Nest\english\server\node_modules\socket.io" 2>nul
mklink /J "g:\test\Nest\english\server\node_modules\alipay-sdk" "g:\test\Nest\english\node_modules\.pnpm\alipay-sdk@4.14.0\node_modules\alipay-sdk"
mklink /J "g:\test\Nest\english\server\node_modules\socket.io" "g:\test\Nest\english\node_modules\.pnpm\socket.io@4.8.3\node_modules\socket.io"
exit
