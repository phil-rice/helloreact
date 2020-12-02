import { Stats } from "fs";
import path, { parse, ParsedPath } from "path";
import { Strings } from "./Strings";

const fs = require('fs');

export interface PathAndSha {
    parsedPath: ParsedPath,
    sha: string
}

export interface ContentAndSha {
    content: string,
    sha: string
}

export interface SourceAndTargetDir {
    sourceDir: string,
    targetDir: string
}

export class Files {
    forEachFile<Res>(dir: string): (fn: (file: string) => Promise<Res>) => Promise<Res[]> {
        return fn => fs.promises.readdir(dir).then((files: string[]) => Promise.all(files.map(fn)))
    }

    validateDirectoryExists(message: string, dir: string): Promise<void> {
        return fs.promises.lstat(dir).then((stats: Stats) => { if (!stats.isDirectory()) throw new Error(`${message}: ${dir}`) })
    }

    createDirectoryForFile(parsedPath: ParsedPath): Promise<void> {
        console.log('directories to create', parsedPath.dir);
        return fs.promises.mkdir(parsedPath.dir, { recursive: true })
    }

    saveFileIfDoesntExist(parsedPath: ParsedPath, content: string, sha: string): Promise<void> {
        const newPath = path.join(parsedPath.dir, parsedPath.name, sha);
        const newParsedPath = path.parse(newPath);
        // console.log('parsedPath for sha file', parsedPath, newParsedPath);
        this.createDirectoryForFile(newParsedPath);
        return fs.promises.stat(newPath).then((stat: Stats) => {
            console.log(`filename exists`);
        }, (err: { code: string }) => {
            if (err.code === 'ENOENT') {
                // file does not exist. Create sha files and write updated content to it
                fs.promises.writeFile(newPath, content, 'utf-8').//
                    then(() => {
                        console.log(`${newParsedPath.base} created`)
                    });
            } else {
                console.log('Error saving file: ', err.code);
                throw err
            }
        }
        );
    }

    copyAndChangeFile(fromFileName: ParsedPath, transformer: (raw: string) => string, toFileName: string): Promise<void> {
        // console.log('fromFileName', fromFileName);
        return fs.promises.readFile(path.join(fromFileName.dir, fromFileName.base), 'utf-8').then(transformer).then((content: string) => fs.promises.writeFile(toFileName, content, 'utf-8'))
    }

    copyTransformAndSaveFileForContentAddressableData(
        // sourceAndTargetDir: SourceAndTargetDir,
        fromPath: ParsedPath,
        transformer: (raw: string) => Promise<string>,
        toFileNameFn: (parsedPath: ParsedPath, sha: string) => ParsedPath): Promise<PathAndSha> {
        // console.log('in files -- fromPath', fromPath);
        return fs.promises.readFile(path.join(fromPath.dir, fromPath.base), 'utf-8')
            .then((content: string) => content)
            .then(Strings.findSha)
            .then((contentAndSha: ContentAndSha) => {
                let parsedPath = toFileNameFn(fromPath, contentAndSha.sha);
                // console.log('parsedPath', parsedPath);
                return this.saveFileIfDoesntExist(parsedPath, contentAndSha.content, contentAndSha.sha).//
                    then(() => ({ parsedPath: parsedPath, sha: contentAndSha.sha }))
            })
    }
}

