const fs = require('fs')
const path = require('path')
const h2m = require('h2m')
const Url = require('url')
const {
  exec
} = require('child_process')

/**
 * 解析url，此方法与yuque2book中的parseUrl保持一致
 * @param {*} url 
 */
const parseUrl = (url) => {
  const result = Url.parse(url);
  const origin = `${result.protocol}//${result.host}`;
  let pathname = result.pathname;

  if (!pathname) {
    throw Error("解析失败");
  }

  pathname = pathname.replace(/^\//, "");
  const [group, repo, doc] = pathname.split("/");

  return {
    origin,
    slug: doc,
    name: group + "_" + repo,
    url,
    namespace: group + "/" + repo,
  };
};

/**
 * 将yuque2book下载的html转换为md
 * @param {*} basePath 下载之后的文件目录
 */
const book2md = (basePath) => {
  const tocPath = path.resolve(basePath, './data/json/toc.json')
  const tocStr = fs.readFileSync(tocPath).toString()
  const tocJSON = JSON.parse(tocStr)

  // 依据tocJSON将目录层级结构转换为树结构
  let transObj = {
    root: {
      title: `md-doc`,
      children: []
    }
  }
  for (let i = 0; i < tocJSON.length; i++) {
    let tocObj = tocJSON[i]
    let {
      uuid,
      parent_uuid
    } = tocObj
    transObj[`id-${uuid}`] = tocObj
    if (parent_uuid) {
      transObj[`id-${parent_uuid}`].children = transObj[`id-${parent_uuid}`].children || []
      transObj[`id-${parent_uuid}`].children.push(tocObj)
    } else {
      transObj[`root`].children.push(tocObj)
    }
  }
  // 输入确认是否正确
  // const transTocPath = path.resolve(basePath, './transToc.json')
  // fs.writeFileSync(transTocPath, JSON.stringify(transObj.root))

  let fsmkdirSync = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath)
    }
  }

  /**
   * 以及转换之后的树结构生成文件夹及文档
   * @param {*} Info 当前需要创建的文件夹/文件信息
   * @param {*} prePath 前置路径，逐层累加
   */
  let loopCreateFloder = (Info, prePath) => {
    let {
      title,
      slug,
      children
    } = Info
    let nowPath = `${prePath}/${title}`
    if (children && children.length > 0) {
      // 创建目录
      const floderPath = path.resolve(basePath, nowPath)
      fsmkdirSync(floderPath)
      for (let i = 0; i < children.length; i++) {
        loopCreateFloder(children[i], nowPath)
      }
    } else {
      // 创建文件
      nowPath += `.md`
      const readPath = path.resolve(basePath, `./data/json/${slug}.json`)
      const jsonStr = fs.readFileSync(readPath).toString()
      let body_html = JSON.parse(jsonStr).body_html
      // 对html进行处理，以便适合产出md结构
      body_html = body_html.replace(`<!doctype html><div data-lake-element=\"root\" class=\"lake-engine lake-typography-traditional\" data-parser-by=\"lake2html\"><span data-lake-element=\"anchor\"></span>`, ``)
      body_html = body_html.replace(`<span data-lake-element=\"focus\"></span></div>`, ``)
      body_html = body_html.replace(/\\\"/g, `"`)
      try {
        fs.writeFileSync(path.resolve(basePath, nowPath), `# ${title} \r\n${h2m(body_html)}`)
        // console.error(`nowPath成功:${nowPath}`)
      } catch (e) {
        console.error(`html转换md失败:${nowPath} 
      ${body_html}`)
      }
    }
  }

  const rootPath = `./`
  loopCreateFloder(transObj.root, rootPath)
}

/**
 * 转换方法
 * @param {*} token 语雀的token
 * @param {*} url 需要转换的url
 * @param {*} local 是否将图片存在本地
 */
const yuque2book = async (token, url, local) => {
  let localCMD = local ? ` -l ` : ``
  const cmd = `yuque2book -t ${token} ${localCMD} ${url}`
  exec(cmd, {}, (error) => {
    if (error) {
      throw Error("执行yuque2book失败");
    } else {
      const cwdPath = process.cwd()
      const instance = parseUrl(url);
      if (!instance.namespace || !instance.name) {
        throw Error("没有选择文档仓库");
      }
      const basePath = path.resolve(cwdPath, `./${instance.name}`)
      book2md(basePath)
    }
  })
};

module.exports = yuque2book