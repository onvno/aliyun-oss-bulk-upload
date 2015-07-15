#!/usr/bin/env node

var program = require('commander'),
    aly = require('aliyun-sdk'),
    when = require('when'),
    fs = require('fs'),
    path = require('path'),
    mime = require('mime'),
    readdirp = require('readdirp'),
    readline = require('readline');

var receiver = {
    excludes : function(val) {
        var dirs = [];
        val.split(",").forEach(function(e){
            dirs.push("!"+e)
        });
        return dirs;
    },
    types : function(val) {
        var types = [];
        val.split(",").forEach(function(e){
            types.push("*."+e)
        });
        return types;
    }
};

var alyConfig = {},
    files = [],
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    }),
    question = {
        keyId : function() {
            rl.question("enter aliyun oss access key id: ", function(answer) {
                alyConfig.keyid = answer;
                question.accessKey();
            })
        },
        accessKey : function() {
            rl.question("enter aliyun oss secret access key: ", function(answer) {
                alyConfig.accesskey = answer;
                question.bucketName();
            });
        },
        bucketName : function() {
            rl.question("enter aliyun oss bucket name: ", function(answer) {
                alyConfig.bucket = answer;
                question.domain();
            });
        },
        domain : function() {
            rl.question("enter aliyun oss domain: ", function(answer) {
                alyConfig.domain = answer;
                question.cache();
            });
        },
        cache : function() {
            rl.question("cache config[yes/no]: ", function(answer) {
                if(answer == 'yes') {
                    fs.writeFile('./config.json', JSON.stringify(alyConfig), function (err) {
                        if (err) throw err;
                        console.log('It\'s saved!');
                    });
                }
                rl.close();
            });
        }
    };
rl.on('close',parser);

function parser() {
    program
        .version('0.1.0')
        .usage('[options] [value ...]')
        .option('-d, --dir <requried>', 'target dir')
        .option('-e, --exclude <optional>', 'exclude dir',receiver.excludes)
        .option('-t, --type <optional>', 'file type',receiver.types);

    program.parse(process.argv);

    if(!program.dir) {
        console.log('-d,--dir is required.');
        process.exit(1);
    }

    scan();
}

function scan() {
    readdirp({
        root : program.dir,
        fileFilter : program.type,
        directoryFilter : program.exclude
    }).on('data',function(entry) {
        files.push(entry.path.replace(/\\/g,"/"))
    }).on('end',upload);
}

function upload() {
    var uploaded = 0,all = files.length;
    console.log('files:%d',all);
    var oss = new aly.OSS({
        accessKeyId: alyConfig.keyid,
        secretAccessKey: alyConfig.accesskey,
        securityToken: "",
        endpoint: alyConfig.domain,
        apiVersion: '2013-10-15'
    });
    files.forEach(function(file) {
        fs.readFile(path.join(program.dir,file),function(err,fileData) {
            console.log('read file:%s %s',file,err ? '[err]' : '[ok]');
            oss.putObject({
                Bucket : alyConfig.bucket,
                Key : file,
                Body : fileData,
                ContentType : mime.lookup(file)
            },function(err,fileData){
                uploaded ++;
                console.log('file[%s] upload status:%s ',file,err ? 'err':'ok');
                if(err) throw err;
                if(uploaded == all) process.exit(1);
            })
        });
    })
}

function run() {
    fs.exists('./config.json', function (exists) {
        if(exists) {
            fs.readFile('./config.json',function(err,config) {
                if(err) throw err;
                alyConfig = JSON.parse(config);
                parser();
            })
        } else {
            question.keyId();
        }
    });
}


run();