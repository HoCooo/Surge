/**
 * 根据SSID自动更改策略组和Loon运行模式。
 * 
 * Author: ipuppet
 * GitHub: https://github.com/ipuppet/Profiles/blob/master/Loon/Script/ssid.js
 */

const RunningModel = {
    GlobalDirect: 0,
    ByRule: 1,
    GlobalProxy: 2
}
const ModelTranslation = {
    [RunningModel.GlobalDirect]: "全局直连",
    [RunningModel.ByRule]: "自动分流",
    [RunningModel.GlobalProxy]: "全局代理"
}
const NotificationMode = {
    None: 0, // 关闭通知
    All: 1, // 所有通知
    Matched: 2, // 匹配到配置
    NotMatched: 3 // 未匹配到配置
}

class ModelRegulator {
    constructor() {
        this.config = JSON.parse($config.getConfig())
        this.defaultModel = { runningModel: RunningModel.ByRule }
    }

    /**
     * 配置某网络下的运行模式
     * @param {Object} modelList 格式如下：
     * "ssid名称": {
     *     runningModel: RunningModel.GlobalDirect, // 运行模式
     *     selectPolicy: { // 设置策略组
     *         "Proxy": "DIRECT", // 节点或其他策略明称，如：'日本 1.5x'、'自动测试'
     *         "Google": "Proxy", // 将名称为 Google 的策略改为 Proxy
     *         "Telegram": "Proxy", // 将名称为 Telegram 的策略改为 Proxy
     *     }
     * }
     * @returns this
     */
    setModelList(modelList) {
        Object.keys(modelList).forEach(ssid => {
            if (typeof modelList[ssid].runningModel === "string")
                modelList[ssid].runningModel = RunningModel[modelList[ssid].runningModel]
        })
        this.modelList = modelList
        return this
    }

    /**
     * 所有未配置的网络更改均走此配置
     * @param {Object} defaultModel 
     * @returns this
     */
    setDelaultModel(defaultModel) {
        if (typeof defaultModel?.runningModel === "string")
            defaultModel.runningModel = RunningModel[defaultModel.runningModel]
        this.defaultModel = defaultModel
        return this
    }

    /**
     * 配置通知
     * @param {Number} notification NotificationMode
     * @returns this
     */
    setNotificationMode(notificationMode) {
        this.notificationMode = notificationMode
        return this
    }

    _isNotification() {
        if (this.notificationMode === NotificationMode.All) return true
        if (this.notificationMode === NotificationMode.None) return false
        const model = this._getModel()
        if (model === this.defaultModel) {
            if (this.notificationMode === NotificationMode.NotMatched) return true
        } else if (this.notificationMode === NotificationMode.Matched) {
            return true
        }
        return false
    }

    _getModel() {
        return this.modelList[this.config.ssid] ?? this.defaultModel
    }

    /**
     * 切换运行模式
     * @param {Function} callback 
     */
    changeModel(callback) {
        const config = Object.assign(this._getModel(), { ssid: this.config.ssid })
        let message = ""
        if (undefined !== config.runningModel) {
            message += `运行模式 -> ${ModelTranslation[config.runningModel]}\n`
            $config.setRunningModel(config.runningModel)
        }
        if (undefined !== config.selectPolicy) {
            message += `策略组变更:\n `
            for (let policy of Object.keys(config.selectPolicy)) {
                $config.setSelectPolicy(policy, config.selectPolicy[policy])
                message += `${policy} -> ${config.selectPolicy[policy]}\n`
            }
        }
        if (this._isNotification()) {
            $notification.post("网络变化", `网络已切换到：${config.ssid}`, message)
        }
        if (typeof callback === "function") callback()
    }
}

class DataCenter {
    constructor() {
        this.keyPrefix = ""
        this.empty = [
            undefined,
            null,
            ""
        ]
    }

    /**
     * 增加一个空集元素
     * @param {*} empty 
     * @returns this
     */
    addEmpty(empty) {
        this.empty.push(empty)
        return this
    }

    /**
     * 设置空集
     * @param {Array} empty 
     * @returns this
     */
    setEmpty(empty) {
        this.empty = empty
        return this
    }

    /**
     * item 为空则返回 true
     * @param {*} item 
     * @returns {Boolean}
     */
    isEmpty(item) {
        if (item instanceof Array) {
            return item.length === 0
        } else if (typeof item === "object") {
            return Object.keys(item).length === 0
        } else {
            return this.empty.includes(item)
        }
    }

    /**
     * 设置 key 前缀
     * @param {String} keyPrefix 
     * @returns this
     */
    setKeyPrefix(keyPrefix) {
        this.keyPrefix = keyPrefix
        return this
    }

    /**
     * 获取数据
     * @param {String} key 键
     * @param {*} _default 未找到时的默认值，默认为 null
     * @param {Boolean} json 是否需要 json 解码
     * @returns {*}
     */
    getData(key, _default = null, json = false) {
        let value = $persistentStore.read(this.keyPrefix + key)
        if (json) value = JSON.parse(value)
        return this.isEmpty(value) ? _default : value
    }

    /**
     * 写入数据
     * @param {*} value 
     * @param {String} key 
     */
    setData(value, key) {
        if (typeof value === "object") {
            value = JSON.stringify(value)
        }
        $persistentStore.write(value, key)
    }
}

const dc = new DataCenter()
dc.setKeyPrefix("ipuppet.boxjs.ssid.")

const userStorage = {
    notificationMode: dc.getData("notificationMode", "All"),
    defaultModel: dc.getData("defaultModel", { runningModel: RunningModel.ByRule }, true),
    modelList: dc.getData("modelList", {}, true)
}

const modelRegulator = new ModelRegulator()
modelRegulator
    .setNotificationMode(NotificationMode[userStorage.notificationMode])
    .setDelaultModel(userStorage.defaultModel)
    .setModelList(userStorage.modelList)
    .changeModel(() => { $done({}) })
