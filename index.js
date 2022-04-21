const axios = require('axios')
const axiosSaveFile = require('axios-savefile');

class CctvParser {
    async getCollectionPageUrls(collectionUrl) {
        // https://tv.cctv.com/2012/12/10/VIDA1355117645556909.shtml
        const { data: content } = await axios.get(collectionUrl, {
            responseType: 'document',
        })
        //console.log(content.substr(0, 1000))
        const createHtmlDom = require('htmldom')
        let $ = createHtmlDom(content)
        const urls = []
        $('#fpy_ind04 > dd').each((index, item) => {
            const link = $(item).find('.img > a').eq(0)
            urls.push({
                title: link.attr('title'),
                url: link.attr('href')
            })
        })
        //console.log(urls)
        return urls.map(item => item.url)
    }

    async getPidFromPageUrl(pageUrl) {
        // https://tv.cctv.com/2017/08/21/VIDElliLDcfRO2Ahnbe0Ylvl170821.shtml?spm=C55924871139.Pgs04HUnRbTI.0.0
        const { data: content } = await axios.get(pageUrl, {
            responseType: 'document',
        })
        //console.log(content.substr(0, 1000))
        const matched = content.match('var guid = "(.*)"')
        if (matched && matched.length === 2) {
            return matched[1]
        }
        throw new Error('no guid found')
    }

    async getVideoInfos(pid) {
        const { data } = await axios.get(`https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=${pid}`)
        // 取最高清的
        const video = data.video
        let highIndex = 0
        highIndex = video.lowChapters ? (video.validChapterNum - 1) : video
        if (!video['chapters' + highIndex]) {
            highIndex = ''
        }
        const urls = video['chapters' + highIndex].map(item => item.url)
        return {
            title: data.title,
            urls: urls,
        }
    }
}

class VideoHandler {
    async downloadAndMerge(savePath, urls) {
        console.log('start download')
        const files = []
        await Promise.all(urls.map(async (item, index) => {
            //files.push(`file    ./tmp/${index}.mp4`)
            const name = `tmp/${index}.mp4`
            files.push(`./${name}`)
            await axiosSaveFile(item, `${__dirname}/${name}`)
            console.log('download success:' + name)
        }))
        await this._mergeFiles(files, savePath)
    }
    async _mergeFiles(files, savePath) {
        console.log('start merge')

        // 速度慢，单合出来的文件比较小
        /* const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
        const ffprobePath = require('@ffprobe-installer/ffprobe').path
        const ffmpeg = require('fluent-ffmpeg')
        ffmpeg.setFfmpegPath(ffmpegPath)
        ffmpeg.setFfprobePath(ffprobePath)

        const ff = ffmpeg()
        files.forEach(item => ff.mergeAdd(item))

        new Promise((resolve, reject) => {
            ff
                .on('start', function (commandLine) {
                    console.log('Spawned Ffmpeg with command: ' + commandLine);
                })
                .on('progress', function(progress) {
                    console.log('Processing: ' + progress.percent + '% done');
                  })
                .on('error', function (err) {
                    console.log('An error occurred: ' + err.message);
                    reject()
                })
                .on('end', function () {
                    console.log('Merging finished !');
                    resolve()
                })
                .mergeToFile(savePath)
        }) */

        // 合并速度快，但合出来文件较大
        const fs = require('fs')
        fs.writeFileSync('./files.txt', files.map(item => `file ${item}`).join("\n"))
        const spawn = require('child_process').spawn;
        const params = [
            '-f', 'concat',
            '-safe', '0',
            '-i', './files.txt',
            '-y',
            '-c', 'copy',
            savePath
        ]
        const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
        await new Promise((resolve, reject) => {
            const ffmpeg = spawn(ffmpegPath, params);
            ffmpeg.stdout.on('data', data => {
                console.log(data.toString());
            })
            ffmpeg.stderr.on('data', data => {
                console.error(data.toString());
            })
            ffmpeg.on('exit', (code) => {
                console.log('exit', code)
                if (code === 0) {
                    resolve()
                } else {
                    reject()
                }
            })
        })
    }
}

const startPage = async (pageUrl) => {
    const cctvParser = new CctvParser()
    const pid = await cctvParser.getPidFromPageUrl(pageUrl)
    const { title, urls } = await cctvParser.getVideoInfos(pid)

    console.log({ title, urls })

    const videoHandler = new VideoHandler()
    await videoHandler.downloadAndMerge(`./videos/${title}.mp4`, urls)
}

const startCollection = async (collectionUrl) => {
    const cctvParser = new CctvParser()
    const urls = await cctvParser.getCollectionPageUrls(collectionUrl)
    console.log(urls)

    // 一起下载需要考虑文件名重复问题，因此先做成逐个下载
    /* await Promise.all(urls.map(async (item) => {
        await this.startPage(item)
    })) */

    for (let i = 0; i < urls.length; i++) {
        await startPage(urls[i])
    }
}

//startPage('https://tv.cctv.com/2017/08/21/VIDElliLDcfRO2Ahnbe0Ylvl170821.shtml?spm=C55924871139.Pgs04HUnRbTI.0.0')

//《美丽中国》
//startCollection('https://tv.cctv.com/2012/12/10/VIDA1355117645556909.shtml')
//《蓝色星球》
//startCollection('http://tv.cctv.com/2012/12/15/VIDA1355581973757239.shtml')
//《如果国宝会说话》
//startCollection('http://tv.cctv.com/2017/12/21/VIDAWE377ZDQH69msDk6KUle171221.shtml')
