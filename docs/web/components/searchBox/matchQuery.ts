import markdownIt from 'markdown-it'
import markdownItTocDoneRight from 'markdown-it-toc-done-right'
import { flatArray } from '@/utils/flatArray'

interface ISearchItem {
  title: string
  text: string
  textHtml: string
  path: string
  isTitle: boolean
}

interface IContentItem {
  title: string
  text: string
}

interface IFile {
  path: string
  title: string
}

interface IFileConfig {
  title: string
  path: string
  routes: IFileConfig[]
  rawFile?: string
}

interface IMatchQuery {
  fileConfig: IFileConfig[]
  match: (query: string, config: any) => Promise<any[]>
}

class matchQuery implements IMatchQuery {
  public fileConfig: IFileConfig[] = []

  // 读取文件内容
  public async readFileConfigList (config: any) {
    if (this.fileConfig.length > 0) return
    const fileConfig = JSON.parse(JSON.stringify(config))
    const readFile = async (path: string) => {
      try {
        return (await import(`../../markdown/${path}.md`)).default
      } catch (e) {
        console.error('readFile', e)
        return ''
      }
    }
    for (const item of fileConfig) {
      if (item.path) {
        item.rawFile = await readFile(item.path.replace(/\$/g, '/'))
      }
      if (item.routes) {
        for (const itemTwo of item.routes) {
          itemTwo.rawFile = await readFile(itemTwo.path.replace(/\$/g, '/'))
        }
      }
    }
    this.fileConfig = fileConfig
  }

  // 全局搜索
  public match = async (query: string, config: any) => {
    await this.readFileConfigList(config)
    const beginTime = Date.now()
    const resultList: any[] = []
    const getDataList = (data: IFileConfig, dataList: any[]) => {
      const matchData = this.matchFile(query, data)
      if (matchData.length) {
        return [...dataList, {
          title: data.title,
          list: matchData
        }]
      }
      return dataList
    }
    for (const item of this.fileConfig) {
      let dataList: any[] = []
      if (item.rawFile) {
        dataList = getDataList(item, dataList)
      }
      if (item.routes) {
        let dataTwoList: any[] = []
        for (const itemTwo of item.routes) {
          dataTwoList = getDataList(itemTwo, dataTwoList)
        }
        dataList = [...dataList, ...dataTwoList]
      }
      if (dataList.length) {
        resultList.push({
          title: item.title,
          list: dataList
        })
      }
    }
    console.log('关键词', query)
    console.log('搜索结果', resultList)
    console.log(`搜索耗时: ${Date.now() - beginTime}ms`)
    return resultList
  }

  // 搜一个文件
  public matchFile = (query: string, file: IFile) => {
    const contentList: IContentItem[] = this.handleMarkdown(file.rawFile)
    const resultTitleList = this.matchFileTitle(query, file, contentList)
    const resultContentList = this.matchFileText(query, file, contentList)
    return [...resultTitleList, ...resultContentList]
  }

  // 搜一个文件的标题
  public matchFileTitle = (query: string, file: IFile, contentList: IContentItem[]) => {
    const resultList: ISearchItem[] = []
    const matchTitleData = this.matchText(query, file.title, 5, 3)
    if (matchTitleData.result) {
      resultList.push({
        title: file.title,
        text: file.title,
        textHtml: matchTitleData.textHtml,
        path: file.path,
        isTitle: true
      })
    }
    contentList.forEach((item) => {
      const matchData = this.matchText(query, item.title, 5, 3)
      if (matchData.result) {
        resultList.push({
          title: item.title,
          text: item.title,
          textHtml: matchData.textHtml,
          path: file.path,
          isTitle: true
        })
      }
    })
    return resultList
  }

  // 搜一个文件的内容
  public matchFileText = (query: string, file: IFile, contentList: IContentItem[]) => {
    const resultList: ISearchItem[] = []
    contentList.forEach((item) => {
      const matchData = this.matchText(query, item.text, 5, 3)
      if (matchData.result) {
        resultList.push({
          title: item.title,
          text: matchData.text,
          textHtml: matchData.textHtml,
          path: file.path,
          isTitle: false
        })
      }
    })
    return resultList
  }

  // 搜索一段文本
  public matchText = (query: string, totalText: string, frontSize: number, backSize: number) => {
    var index = totalText.search(query)
    if (index === -1) {
      return {
        result: false,
        text: '',
        textHtml: ''
      }
    }
    const begin: number = Math.max(0, index - frontSize)
    const end: number = Math.min(query.length + index + backSize, totalText.length)
    const text = totalText.slice(begin, end)
    return {
      result: true,
      text,
      textHtml: text.replace(query, `<span class="matchTextHighlight">${query}</span>`)
    }
  }

  // 处理文件
  public handleMarkdown = (rawFile: string) => {
    let sideMenuList: any[] = []
    const md = markdownIt({
      highlight: function (str, lang) {
        return ``
      }
    })
    md.use(markdownItTocDoneRight, {
      callback: (_, ast) => {
        sideMenuList = ast.c
      }
    })
    md.render(rawFile)
    const headerList = flatArray(sideMenuList, 'c')
    const contentList: IContentItem[] = []
    headerList.reverse().forEach((item) => {
      const front = new Array(item.l).fill('#').join('')
      const [left, right] = rawFile.split(`${front} ${item.n}`)
      rawFile = left
      contentList.push({
        title: item.n,
        text: (right || '').replace(/[^\a-\z\A-\Z0-9\u4E00-\u9FA5\：\.\，\、\。\；]/g, '')
      })
    })
    return contentList.reverse()
  }
}

export default new matchQuery()