# BioSynapse 原型静态站点
# 原型是零依赖纯静态页面，不需要 Node/构建步骤，直接用 nginx 托管 prototype/
FROM nginx:alpine

COPY prototype/ /usr/share/nginx/html/

EXPOSE 80
