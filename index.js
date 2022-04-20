const axios = require('axios')
const axiosSaveFile = require('axios-savefile');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

class CctvParser {
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
        console.log(pid)
        const { data } = await axios.get(`https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=${pid}`)
        // 取最高清的
        const urls = data.video['chapters' + (data.video.validChapterNum - 1)].map(item => item.url)
        return {
            title: data.title,
            urls: urls,
        }
    }
}

class VideoHandler {
    async downloadAndMerge(savePath, urls) {
        const files = []
        await Promise.all(urls.map(async (item, index) => {
            files.push(`file    ./tmp/${index}.mp4`)
            await axiosSaveFile(item, `${__dirname}/tmp/${index}.mp4`)
        }))
        this._mergeFiles(files, savePath)
    }
    _mergeFiles(files, savePath) {
        const fs = require('fs')
        fs.writeFileSync('./files.txt', files.join("\n"))
        const spawn = require('child_process').spawn;
        const params = [
            '-f', 'concat',
            '-safe', '0',
            '-i', './files.txt',
            '-c', 'copy',
            savePath
        ]
        const ffmpeg = spawn(ffmpegPath, params);
        ffmpeg.stdout.on('data', data => {
            console.log(data.toString());
        })
        ffmpeg.stderr.on('data', data => {
            console.error(data.toString());
        })
        ffmpeg.on('exit', (code) => {
            console.log('exit', code)
        })
    }
}

const start = async (pageUrl) => {
    const cctvParser = new CctvParser()
    const pid = await cctvParser.getPidFromPageUrl(pageUrl)
    const { title, urls } = await cctvParser.getVideoInfos(pid)

    console.log({title, urls})

    const videoHandler = new VideoHandler()
    videoHandler.downloadAndMerge(`./videos/${title}.mp4`, urls)
}

start('https://tv.cctv.com/2017/08/21/VIDElliLDcfRO2Ahnbe0Ylvl170821.shtml?spm=C55924871139.Pgs04HUnRbTI.0.0')