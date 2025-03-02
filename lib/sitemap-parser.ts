import sax, { SAXStream } from 'sax';
import {
  Readable,
  Transform,
  TransformOptions,
  TransformCallback,
} from 'stream';
import {
  SitemapItem,
  isValidChangeFreq,
  isValidYesNo,
  VideoItem,
  Img,
  LinkItem,
  NewsItem,
  ErrorLevel,
  isAllowDeny,
  isPriceType,
  isResolution,
  TagNames,
} from './types';

function isValidTagName(tagName: string): tagName is TagNames {
  // This only works because the enum name and value are the same
  return tagName in TagNames;
}

function tagTemplate(): SitemapItem {
  return {
    img: [],
    video: [],
    links: [],
    url: '',
  };
}

function videoTemplate(): VideoItem {
  return {
    tag: [],
    thumbnail_loc: '',
    title: '',
    description: '',
  };
}

const imageTemplate: Img = {
  url: '',
};

const linkTemplate: LinkItem = {
  lang: '',
  url: '',
};

function newsTemplate(): NewsItem {
  return {
    publication: { name: '', language: '' },
    publication_date: '',
    title: '',
  };
}
export interface XMLToSitemapItemStreamOptions extends TransformOptions {
  level?: ErrorLevel;
}
const defaultStreamOpts: XMLToSitemapItemStreamOptions = {};

// TODO does this need to end with `options`
/**
 * Takes a stream of xml and transforms it into a stream of SitemapItems
 * Use this to parse existing sitemaps into config options compatible with this library
 */
export class XMLToSitemapItemStream extends Transform {
  level: ErrorLevel;
  saxStream: SAXStream;
  constructor(opts = defaultStreamOpts) {
    opts.objectMode = true;
    super(opts);
    this.saxStream = sax.createStream(true, {
      xmlns: true,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      strictEntities: true,
      trim: true,
    });
    this.level = opts.level || ErrorLevel.WARN;
    let currentItem: SitemapItem = tagTemplate();
    let currentTag: string;
    let currentVideo: VideoItem = videoTemplate();
    let currentImage: Img = { ...imageTemplate };
    let currentLink: LinkItem = { ...linkTemplate };
    let dontpushCurrentLink = false;
    this.saxStream.on('opentagstart', (tag): void => {
      currentTag = tag.name;
      if (currentTag.startsWith('news:') && !currentItem.news) {
        currentItem.news = newsTemplate();
      }
    });

    this.saxStream.on('opentag', (tag): void => {
      if (isValidTagName(tag.name)) {
        if (tag.name === 'xhtml:link') {
          if (
            typeof tag.attributes.rel === 'string' ||
            typeof tag.attributes.href === 'string'
          ) {
            return;
          }
          if (
            tag.attributes.rel.value === 'alternate' &&
            tag.attributes.hreflang
          ) {
            currentLink.url = tag.attributes.href.value;
            if (typeof tag.attributes.hreflang === 'string') return;
            currentLink.lang = tag.attributes.hreflang.value as string;
          } else if (tag.attributes.rel.value === 'alternate') {
            dontpushCurrentLink = true;
            currentItem.androidLink = tag.attributes.href.value;
          } else if (tag.attributes.rel.value === 'amphtml') {
            dontpushCurrentLink = true;
            currentItem.ampLink = tag.attributes.href.value;
          } else {
            console.log('unhandled attr for xhtml:link', tag.attributes);
          }
        }
      } else {
        console.warn('unhandled tag', tag.name);
      }
    });

    this.saxStream.on('text', (text): void => {
      switch (currentTag) {
        case 'mobile:mobile':
          break;
        case TagNames.loc:
          currentItem.url = text;
          break;
        case TagNames.changefreq:
          if (isValidChangeFreq(text)) {
            currentItem.changefreq = text;
          }
          break;
        case TagNames.priority:
          currentItem.priority = parseFloat(text);
          break;
        case TagNames.lastmod:
          currentItem.lastmod = text;
          break;
        case TagNames['video:thumbnail_loc']:
          currentVideo.thumbnail_loc = text;
          break;
        case TagNames['video:tag']:
          currentVideo.tag.push(text);
          break;
        case TagNames['video:duration']:
          currentVideo.duration = parseInt(text, 10);
          break;
        case TagNames['video:player_loc']:
          currentVideo.player_loc = text;
          break;
        case TagNames['video:requires_subscription']:
          if (isValidYesNo(text)) {
            currentVideo.requires_subscription = text;
          }
          break;
        case TagNames['video:publication_date']:
          currentVideo.publication_date = text;
          break;
        case TagNames['video:id']:
          currentVideo.id = text;
          break;
        case TagNames['video:restriction']:
          currentVideo.restriction = text;
          break;
        case TagNames['video:view_count']:
          currentVideo.view_count = parseInt(text, 10);
          break;
        case TagNames['video:uploader']:
          currentVideo.uploader = text;
          break;
        case TagNames['video:family_friendly']:
          if (isValidYesNo(text)) {
            currentVideo.family_friendly = text;
          }
          break;
        case TagNames['video:expiration_date']:
          currentVideo.expiration_date = text;
          break;
        case TagNames['video:platform']:
          currentVideo.platform = text;
          break;
        case TagNames['video:price']:
          currentVideo.price = text;
          break;
        case TagNames['video:rating']:
          currentVideo.rating = parseFloat(text);
          break;
        case TagNames['video:category']:
          currentVideo.category = text;
          break;
        case TagNames['video:live']:
          if (isValidYesNo(text)) {
            currentVideo.live = text;
          }
          break;
        case TagNames['video:gallery_loc']:
          currentVideo.gallery_loc = text;
          break;
        case TagNames['image:loc']:
          currentImage.url = text;
          break;
        case TagNames['image:geo_location']:
          currentImage.geoLocation = text;
          break;
        case TagNames['image:license']:
          currentImage.license = text;
          break;
        case TagNames['news:access']:
          if (!currentItem.news) {
            currentItem.news = newsTemplate();
          }
          currentItem.news.access = text as NewsItem['access'];
          break;
        case TagNames['news:genres']:
          if (!currentItem.news) {
            currentItem.news = newsTemplate();
          }
          currentItem.news.genres = text;
          break;
        case TagNames['news:publication_date']:
          if (!currentItem.news) {
            currentItem.news = newsTemplate();
          }
          currentItem.news.publication_date = text;
          break;
        case TagNames['news:keywords']:
          if (!currentItem.news) {
            currentItem.news = newsTemplate();
          }
          currentItem.news.keywords = text;
          break;
        case TagNames['news:stock_tickers']:
          if (!currentItem.news) {
            currentItem.news = newsTemplate();
          }
          currentItem.news.stock_tickers = text;
          break;
        case TagNames['news:language']:
          if (!currentItem.news) {
            currentItem.news = newsTemplate();
          }
          currentItem.news.publication.language = text;
          break;
        case TagNames['video:title']:
          currentVideo.title += text;
          break;
        case TagNames['video:description']:
          currentVideo.description += text;
          break;
        case TagNames['news:name']:
          if (!currentItem.news) {
            currentItem.news = newsTemplate();
          }
          currentItem.news.publication.name += text;
          break;
        case TagNames['news:title']:
          if (!currentItem.news) {
            currentItem.news = newsTemplate();
          }
          currentItem.news.title += text;
          break;
        case TagNames['image:caption']:
          if (!currentImage.caption) {
            currentImage.caption = text;
          } else {
            currentImage.caption += text;
          }
          break;
        case TagNames['image:title']:
          if (!currentImage.title) {
            currentImage.title = text;
          } else {
            currentImage.title += text;
          }
          break;

        default:
          console.log('unhandled text for tag:', currentTag, `'${text}'`);
          break;
      }
    });

    this.saxStream.on('cdata', (text): void => {
      switch (currentTag) {
        case TagNames['video:title']:
          currentVideo.title += text;
          break;
        case TagNames['video:description']:
          currentVideo.description += text;
          break;
        case TagNames['news:name']:
          if (!currentItem.news) {
            currentItem.news = newsTemplate();
          }
          currentItem.news.publication.name += text;
          break;
        case TagNames['news:title']:
          if (!currentItem.news) {
            currentItem.news = newsTemplate();
          }
          currentItem.news.title += text;
          break;
        case TagNames['image:caption']:
          if (!currentImage.caption) {
            currentImage.caption = text;
          } else {
            currentImage.caption += text;
          }
          break;
        case TagNames['image:title']:
          if (!currentImage.title) {
            currentImage.title = text;
          } else {
            currentImage.title += text;
          }
          break;

        default:
          console.log('unhandled cdata for tag:', currentTag);
          break;
      }
    });

    this.saxStream.on('attribute', (attr): void => {
      switch (currentTag) {
        case TagNames['urlset']:
        case TagNames['xhtml:link']:
        case TagNames['video:id']:
          break;
        case TagNames['video:restriction']:
          if (attr.name === 'relationship' && isAllowDeny(attr.value)) {
            currentVideo['restriction:relationship'] = attr.value;
          } else {
            console.log('unhandled attr', currentTag, attr.name);
          }
          break;
        case TagNames['video:price']:
          if (attr.name === 'type' && isPriceType(attr.value)) {
            currentVideo['price:type'] = attr.value;
          } else if (attr.name === 'currency') {
            currentVideo['price:currency'] = attr.value;
          } else if (attr.name === 'resolution' && isResolution(attr.value)) {
            currentVideo['price:resolution'] = attr.value;
          } else {
            console.log('unhandled attr for video:price', attr.name);
          }
          break;
        case TagNames['video:player_loc']:
          if (attr.name === 'autoplay') {
            currentVideo['player_loc:autoplay'] = attr.value;
          } else {
            console.log('unhandled attr for video:player_loc', attr.name);
          }
          break;
        case TagNames['video:platform']:
          if (attr.name === 'relationship' && isAllowDeny(attr.value)) {
            currentVideo['platform:relationship'] = attr.value;
          } else {
            console.log(
              'unhandled attr for video:platform',
              attr.name,
              attr.value
            );
          }
          break;
        case TagNames['video:gallery_loc']:
          if (attr.name === 'title') {
            currentVideo['gallery_loc:title'] = attr.value;
          } else {
            console.log('unhandled attr for video:galler_loc', attr.name);
          }
          break;
        default:
          console.log('unhandled attr', currentTag, attr.name);
      }
    });

    this.saxStream.on('closetag', (tag): void => {
      switch (tag) {
        case TagNames.url:
          this.push(currentItem);
          currentItem = tagTemplate();
          break;
        case TagNames['video:video']:
          currentItem.video.push(currentVideo);
          currentVideo = videoTemplate();
          break;
        case TagNames['image:image']:
          currentItem.img.push(currentImage);
          currentImage = { ...imageTemplate };
          break;
        case TagNames['xhtml:link']:
          if (!dontpushCurrentLink) {
            currentItem.links.push(currentLink);
          }
          currentLink = { ...linkTemplate };
          break;

        default:
          break;
      }
    });
  }

  _transform(
    data: string,
    encoding: string,
    callback: TransformCallback
  ): void {
    // correcting the type here can be done without making it a breaking change
    // TODO fix this
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.saxStream.write(data, encoding);
    callback();
  }
}

/**
  Read xml and resolve with the configuration that would produce it or reject with
  an error
  ```
  const { createReadStream } = require('fs')
  const { parseSitemap, createSitemap } = require('sitemap')
  parseSitemap(createReadStream('./example.xml')).then(
    // produces the same xml
    // you can, of course, more practically modify it or store it
    (xmlConfig) => console.log(createSitemap(xmlConfig).toString()),
    (err) => console.log(err)
  )
  ```
  @param {Readable} xml what to parse
  @return {Promise<SitemapItem[]>} resolves with list of sitemap items that can be fed into a SitemapStream. Rejects with an Error object.
 */
export async function parseSitemap(xml: Readable): Promise<SitemapItem[]> {
  const urls: SitemapItem[] = [];
  return new Promise((resolve, reject): void => {
    xml
      .pipe(new XMLToSitemapItemStream())
      .on('data', (smi: SitemapItem) => urls.push(smi))
      .on('end', (): void => {
        resolve(urls);
      })
      .on('error', (error: Error): void => {
        reject(error);
      });
  });
}

export interface ObjectStreamToJSONOptions extends TransformOptions {
  lineSeparated: boolean;
}

const defaultObjectStreamOpts: ObjectStreamToJSONOptions = {
  lineSeparated: false,
};
/**
 * A Transform that converts a stream of objects into a JSON Array or a line
 * separated stringified JSON
 * @param [lineSeparated=false] whether to separate entries by a new line or comma
 */
export class ObjectStreamToJSON extends Transform {
  lineSeparated: boolean;
  firstWritten: boolean;

  constructor(opts = defaultObjectStreamOpts) {
    opts.writableObjectMode = true;
    super(opts);
    this.lineSeparated = opts.lineSeparated;
    this.firstWritten = false;
  }

  _transform(
    chunk: SitemapItem,
    encoding: string,
    cb: TransformCallback
  ): void {
    if (!this.firstWritten) {
      this.firstWritten = true;
      if (!this.lineSeparated) {
        this.push('[');
      }
    } else if (this.lineSeparated) {
      this.push('\n');
    } else {
      this.push(',');
    }
    if (chunk) {
      this.push(JSON.stringify(chunk));
    }
    cb();
  }

  _flush(cb: TransformCallback): void {
    if (!this.lineSeparated) {
      this.push(']');
    }
    cb();
  }
}
