import BackgroundRemover from '@/components/background-remover';
import { HomeHelp } from '@/components/home-help';
import { PageSchema } from '@/components/page-schema';
import { SiteFooter } from '@/components/site-footer';
import { homeCopy } from '@/lib/copy';
import type { HomePath } from '@/lib/seo';

const noScript: Record<HomePath, string> = {
  '/': 'Enable JavaScript to upload a photo and remove its background. The guides linked on this page explain how the tool works.',
  '/id':
    'Aktifkan JavaScript untuk mengunggah foto dan menghapus background-nya. Panduan di halaman ini menjelaskan cara kerja alat ini.',
  '/pt-br':
    'Ative o JavaScript para enviar uma foto e remover o fundo. Os guias nesta página explicam como a ferramenta funciona.',
  '/es':
    'Activa JavaScript para subir una foto y quitar su fondo. Las guías de esta página explican cómo funciona la herramienta.',
};

export function HomePage({ path }: { path: HomePath }) {
  return (
    <>
      <PageSchema path={path} />
      <BackgroundRemover
        copy={homeCopy[path].remover}
        homeHref={path}
        footer={<SiteFooter home={path} />}
      >
        <HomeHelp home={path} />
        <noscript>
          <p className="no-script">{noScript[path]}</p>
        </noscript>
      </BackgroundRemover>
    </>
  );
}
