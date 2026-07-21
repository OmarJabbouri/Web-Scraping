import { Site } from './Site.js';
import { Page } from './Page.js';
import { PageVersion } from './PageVersion.js';
import { Document } from './Document.js';
import { Chunk } from './Chunk.js';
import { FailedJob } from './FailedJob.js';

Site.hasMany(Page, { foreignKey: 'siteId', as: 'pages' });
Page.belongsTo(Site, { foreignKey: 'siteId', as: 'site' });

Page.hasMany(PageVersion, { foreignKey: 'pageId', as: 'versions' });
PageVersion.belongsTo(Page, { foreignKey: 'pageId', as: 'page' });

PageVersion.hasOne(Document, { foreignKey: 'pageVersionId', as: 'document' });
Document.belongsTo(PageVersion, { foreignKey: 'pageVersionId', as: 'pageVersion' });

Document.hasMany(Chunk, { foreignKey: 'documentId', as: 'chunks' });
Chunk.belongsTo(Document, { foreignKey: 'documentId', as: 'document' });

export { Site, Page, PageVersion, Document, Chunk, FailedJob };
export type { RenderMode } from './Site.js';
export type { PageStatus } from './Page.js';
export type { ContentType } from './Document.js';
