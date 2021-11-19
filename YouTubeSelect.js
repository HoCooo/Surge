const BASE_URL = "https://www.youtube.com/premium"
const needRegion = "CN"
// let params = getParams($argument)
let youtubeGroup = "🇭🇰 香港节点"
let subPolicy = []
var nowSubPolicy = ""
    ; (async () => {

        let subProxies = (await httpAPI("/v1/policy_groups"))[youtubeGroup];
        nowSubPolicy = (await httpAPI("/v1/policy_groups/select?group_name=" + encodeURIComponent(youtubeGroup) + "")).policy;
        let nowIndex = 0
        for (var key in subProxies) {
            if (subProxies[key].name === nowSubPolicy) {
                nowIndex = key
            }

            subPolicy.push(subProxies[key].name)
        }

        for (let index = 0; index < subPolicy.length; index++) {
            $surge.setSelectGroupPolicy(youtubeGroup, subPolicy[(nowIndex + index) % subPolicy.length]);
            try {
                let region = await Promise.race([test(), timeout(3000)])
                console.log(region)
                if (region === needRegion) {
                    $done({
                        title: "油管送中节点切换",
                        content: "当前节点："+subPolicy[(nowIndex + index) % subPolicy.length]
                    })
                    return
                }
            } catch (error) {
                console.log(error)
            }
        }

        $surge.setSelectGroupPolicy(youtubeGroup, nowSubPolicy);

        $done({
            title: "油管送中节点切换",
            content: "当前节点："+subPolicy[nowIndex]
        })

    })()

function test() {
    return new Promise((resolve, reject) => {
        let option = {
            url: BASE_URL,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
                'Accept-Language': 'en',
            },
        }
        $httpClient.get(option, function (error, response, data) {
            if (error != null || response.status !== 200) {
                reject('Error')
                return
            }


            let region = getRegion(data);

            resolve(region.toUpperCase())
        })
    })
}



function getRegion(data) {
    let region = "";

    if (data.indexOf('www.google.cn') !== -1 && data.indexOf('Premium is not available in your country') !== -1) {
        region = "CN";
    } else {
        let re = new RegExp('"countryCode":"(.*?)"', "gm");
        let result = re.exec(data);
        if (result != null && result.length === 2) {
            region = result[1];
        } else {
            region = "US";
        }
    }

    return region;
}

function timeout(delay = 5000) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject('Timeout')
        }, delay)
    })
}

function httpAPI(path = "", method = "GET", body = null) {
    return new Promise((resolve) => {
        $httpAPI(method, path, body, (result) => {
            resolve(result);
        });
    });
};
