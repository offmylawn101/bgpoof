import type { GuidePath, HomePath } from './seo';

const removerEn = {
  home: 'bgpoof home',
  headerNote: 'Free. No account needed.',
  uploadLabel: 'Upload photo',
  eyebrow: 'A little less background. A lot more photo.',
  headingStart: 'Free background',
  headingEnd: 'remover.',
  introStart: 'Remove the background from any image in seconds.',
  introEnd: 'Drop it in. Get a transparent PNG.',
  upload: 'Upload image',
  drop: 'or drop a photo anywhere',
  paste: 'You can also paste with',
  fileHint: 'JPG, PNG, WebP · up to 25 MB / 25 MP',
  secure: 'Processed securely by Cloudflare.',
  imageProcessed: 'image processed',
  imagesProcessed: 'images processed',
  credit: 'Project by',
  demoSection: 'Background removal example',
  demoCaption: 'See what disappears.',
  tryPhoto: 'Try this photo',
  demoCompare: 'Example before and after',
  slide: 'Slide to see the difference',
  demoCutoutAlt: 'Golden retriever cutout with its background removed',
  demoOriginalAlt: 'Golden retriever outdoors before background removal',
  resultEyebrow: 'YOUR PHOTO, FRONT AND CENTER',
  removed: 'Background removed.',
  working: 'A little disappearing act…',
  tryAgain: 'Let’s try that again.',
  cancelRemoval: 'Cancel removal',
  clearPhoto: 'Remove this photo',
  photoCompare: 'Your photo before and after',
  finishing: 'Finishing your PNG.',
  cutting: 'Making the cut.',
  progress: 'Background removal progress',
  downloadNote: 'Your download will appear when the PNG is ready.',
  cancel: 'Cancel',
  allYours: 'All yours.',
  transparent: 'A transparent background.',
  originalSize: 'Your original resolution.',
  download: 'Download PNG',
  fullResolution: 'full resolution',
  showCutout: 'Show cutout',
  showOriginal: 'Show original',
  tryAnother: 'Try another photo',
  anotherGo: 'Give it another go.',
  anotherGoText: 'You can choose another photo or retry this one.',
  retry: 'Retry removal',
  chooseAnother: 'Choose another photo',
  noAccount: 'No account. No watermark.',
  resultHint:
    'Right-click the image to copy it. Paste or drop another photo to keep going.',
  dismissError: 'Dismiss error',
  dropTitle: 'Drop it like it’s background.',
  dropText: 'Release your photo to start.',
  originalLabel: 'Original',
  removedLabel: 'Background removed',
  cutoutAlt: 'Your photo with a transparent background',
  originalAlt: 'Your original photo',
};

/** Passed to the client as a prop, so other languages stay out of the JS bundle. */
export type RemoverCopy = typeof removerEn & {
  /** Worker, API, and validation messages are written in English; keyed by that text. */
  messages?: Record<string, string>;
};

type HomeCopy = {
  remover: RemoverCopy;
  help: {
    heading: string;
    intro: string;
    steps: { title: string; text: string }[];
    questions: string;
    faq: {
      question: string;
      answer: string;
      link?: { href: string; text: string; after?: string };
    }[];
    guides: string;
    guidesNote?: string;
  };
  footer: {
    tagline: string;
    navigation: string;
    languages: string;
    about: string;
    guides: Record<GuidePath, string>;
  };
};

export const homeCopy: Record<HomePath, HomeCopy> = {
  '/': {
    remover: removerEn,
    help: {
      heading: 'Remove background from an image, free and with no sign-up',
      intro:
        'Need to remove the bg from a photo for a product listing, profile picture, or design? This free bg remover returns a transparent PNG at your photo’s original pixel dimensions, with no watermark or paid download tier.',
      steps: [
        {
          title: '1. Add your photo',
          text: 'Upload a JPG, PNG, or WebP. You can also drop a file anywhere on this page or paste an image from your clipboard.',
        },
        {
          title: '2. Check the cutout',
          text: 'Background removal starts automatically. Once it finishes, use “Show original” to compare the result with your photo.',
        },
        {
          title: '3. Save the PNG',
          text: 'Download the transparent image, or right-click the finished cutout to copy it. The checkerboard is only a preview of the transparent area.',
        },
      ],
      questions: 'Before you upload',
      faq: [
        {
          question: 'Is background removal really free?',
          answer:
            'Yes. You can remove a background and download the PNG without creating an account or paying. BG Poof adds no watermark. To keep the service available, removal requests are rate limited; if you reach the limit, wait a minute and try again.',
        },
        {
          question: 'What photos can I upload?',
          answer:
            'JPG, PNG, and WebP files up to 25 MB and 25 megapixels, with no side longer than 8,192 pixels. Use the clearest original you have. Blurred edges and subjects that blend into the background can be difficult to separate.',
        },
        {
          question: 'Will it keep hair, glass, and shiny objects?',
          answer:
            'Not always. Thin hair, transparent glass, reflective foil, and shadows can confuse automatic removal. BG Poof refines edges, but it cannot reliably recover a large part of a subject that was missed. Read the ',
          link: {
            href: '/background-removal-tips',
            text: 'photo quality and troubleshooting guide',
            after: ' before retrying.',
          },
        },
        {
          question: 'Where does my photo go?',
          answer:
            'Cloudflare processes your upload. Our processing server also receives it for automatic edge refinement when that is enabled. BG Poof does not save uploads or results; your browser keeps the working images while you use the page. ',
          link: {
            href: '/about',
            text: 'Read the processing and privacy details.',
          },
        },
      ],
      guides: 'Photo guides',
    },
    footer: {
      tagline: 'Free to use · No watermarks · No sign-up',
      navigation: 'Help and information',
      languages: 'Language',
      about: 'About & licenses',
      guides: {
        '/how-to-remove-background': 'How to remove a background',
        '/transparent-png': 'Saving a transparent PNG',
        '/background-removal-tips': 'Getting a better cutout',
        '/remove-bg-alternative': 'A free remove.bg alternative',
      },
    },
  },
  '/id': {
    remover: {
      home: 'Beranda bgpoof',
      headerNote: 'Gratis. Tanpa akun.',
      uploadLabel: 'Unggah foto',
      eyebrow: 'Background berkurang. Fotonya makin menonjol.',
      headingStart: 'Hapus background',
      headingEnd: 'foto gratis.',
      introStart: 'Hapus background gambar apa pun dalam hitungan detik.',
      introEnd: 'Masukkan foto, lalu dapatkan PNG transparan.',
      upload: 'Unggah gambar',
      drop: 'atau letakkan foto di mana saja',
      paste: 'Bisa juga tempel dengan',
      fileHint: 'JPG, PNG, WebP · maks. 25 MB / 25 MP',
      secure: 'Diproses dengan aman oleh Cloudflare.',
      imageProcessed: 'gambar diproses',
      imagesProcessed: 'gambar diproses',
      credit: 'Proyek oleh',
      demoSection: 'Contoh penghapusan background',
      demoCaption: 'Lihat apa yang hilang.',
      tryPhoto: 'Coba foto ini',
      demoCompare: 'Contoh sebelum dan sesudah',
      slide: 'Geser untuk melihat perbedaannya',
      demoCutoutAlt: 'Potongan anjing golden retriever tanpa background',
      demoOriginalAlt:
        'Anjing golden retriever di luar ruangan sebelum background dihapus',
      resultEyebrow: 'FOTOMU JADI PUSAT PERHATIAN',
      removed: 'Background dihapus.',
      working: 'Sebentar, background-nya sedang menghilang…',
      tryAgain: 'Ayo coba lagi.',
      cancelRemoval: 'Batalkan penghapusan',
      clearPhoto: 'Hapus foto ini',
      photoCompare: 'Fotomu sebelum dan sesudah',
      finishing: 'Menyelesaikan PNG-mu.',
      cutting: 'Sedang memotong.',
      progress: 'Progres penghapusan background',
      downloadNote: 'Tombol unduh akan muncul saat PNG siap.',
      cancel: 'Batal',
      allYours: 'Sudah jadi.',
      transparent: 'Background transparan.',
      originalSize: 'Resolusi asli fotomu.',
      download: 'Unduh PNG',
      fullResolution: 'resolusi penuh',
      showCutout: 'Lihat hasil',
      showOriginal: 'Lihat foto asli',
      tryAnother: 'Coba foto lain',
      anotherGo: 'Coba sekali lagi.',
      anotherGoText: 'Kamu bisa memilih foto lain atau mencoba lagi foto ini.',
      retry: 'Coba lagi',
      chooseAnother: 'Pilih foto lain',
      noAccount: 'Tanpa akun. Tanpa watermark.',
      resultHint:
        'Klik kanan gambar untuk menyalinnya. Tempel atau letakkan foto lain untuk lanjut.',
      dismissError: 'Tutup pesan kesalahan',
      dropTitle: 'Lepaskan di sini.',
      dropText: 'Lepaskan foto untuk mulai.',
      originalLabel: 'Asli',
      removedLabel: 'Background dihapus',
      cutoutAlt: 'Fotomu dengan background transparan',
      originalAlt: 'Foto aslimu',
      messages: {
        'Preparing your photo…': 'Menyiapkan fotomu…',
        'Removing the background…': 'Menghapus background…',
        'Receiving your cutout…': 'Menerima hasil potongan…',
        'Preparing your preview…': 'Menyiapkan pratinjau…',
        'Preparing your full-resolution image…':
          'Menyiapkan gambar resolusi penuh…',
        'Creating your PNG…': 'Membuat PNG-mu…',
        'Choose a JPG, PNG, or WebP photo.': 'Pilih foto JPG, PNG, atau WebP.',
        'This photo is too large. Choose one smaller than 25 MB.':
          'Foto ini terlalu besar. Pilih yang lebih kecil dari 25 MB.',
        'Choose a photo up to 25 megapixels, with each side under 8,193 pixels.':
          'Pilih foto maksimal 25 megapiksel, dengan tiap sisi di bawah 8.193 piksel.',
        'Choose a photo up to 25 megapixels and 8,192 pixels per side.':
          'Pilih foto maksimal 25 megapiksel dan 8.192 piksel per sisi.',
        'We couldn’t read this photo. Try another JPG, PNG, or WebP.':
          'Foto ini tidak bisa dibaca. Coba JPG, PNG, atau WebP lain.',
        'Choose one photo at a time.': 'Pilih satu foto saja setiap kali.',
        'The example couldn’t load. Upload your own photo to try it.':
          'Contoh tidak bisa dimuat. Unggah fotomu sendiri untuk mencoba.',
        'The example couldn’t load.': 'Contoh tidak bisa dimuat.',
        'Your browser couldn’t prepare this photo.':
          'Browser-mu tidak bisa menyiapkan foto ini.',
        'This photo is too detailed. Try a smaller photo.':
          'Foto ini terlalu detail. Coba foto yang lebih kecil.',
        'The background remover couldn’t finish. Please try again.':
          'Penghapusan background tidak selesai. Silakan coba lagi.',
        'The background remover returned an invalid result. Please try again.':
          'Hasil penghapusan background tidak valid. Silakan coba lagi.',
        'The background remover returned an invalid size. Please try again.':
          'Ukuran hasil penghapusan background tidak valid. Silakan coba lagi.',
        'Your browser couldn’t save this photo. Try a smaller photo.':
          'Browser-mu tidak bisa menyimpan foto ini. Coba foto yang lebih kecil.',
        'The background remover is taking longer than usual. Please try again.':
          'Prosesnya lebih lama dari biasanya. Silakan coba lagi.',
        'We couldn’t reach the background remover. Check your connection and try again.':
          'Layanan tidak bisa dihubungi. Periksa koneksimu lalu coba lagi.',
        'Your browser can’t run the background remover. Try a current version of Chrome, Safari, Firefox, or Edge.':
          'Browser-mu tidak mendukung alat ini. Coba versi terbaru Chrome, Safari, Firefox, atau Edge.',
        'This photo is taking longer than usual. Check your connection and try again.':
          'Foto ini diproses lebih lama dari biasanya. Periksa koneksimu lalu coba lagi.',
        'The background remover couldn’t start. Check your connection, close other tabs, and try again.':
          'Alat ini tidak bisa dimulai. Periksa koneksimu, tutup tab lain, lalu coba lagi.',
        'Background removal is temporarily unavailable. Please try again shortly.':
          'Penghapusan background sedang tidak tersedia. Silakan coba lagi sebentar lagi.',
        'This image could not be read. Try another JPEG, PNG, or WebP image.':
          'Gambar ini tidak bisa dibaca. Coba gambar JPEG, PNG, atau WebP lain.',
        'Too many uploads. Please wait a minute and try again.':
          'Terlalu banyak unggahan. Tunggu satu menit lalu coba lagi.',
        'The image upload was interrupted. Please try again.':
          'Unggahan gambar terputus. Silakan coba lagi.',
        'We couldn’t verify this browser. Refresh the page and try again.':
          'Browser ini tidak bisa diverifikasi. Muat ulang halaman lalu coba lagi.',
      },
    },
    help: {
      heading: 'Hapus background foto online, gratis dan tanpa daftar',
      intro:
        'Perlu menghapus background foto untuk produk jualan, foto profil, atau desain? Alat gratis ini menghasilkan PNG transparan dengan ukuran piksel asli fotomu, tanpa watermark dan tanpa biaya unduhan.',
      steps: [
        {
          title: '1. Masukkan foto',
          text: 'Unggah JPG, PNG, atau WebP. Kamu juga bisa meletakkan file di mana saja di halaman ini atau menempelkan gambar dari clipboard.',
        },
        {
          title: '2. Periksa hasilnya',
          text: 'Penghapusan background berjalan otomatis. Setelah selesai, pakai “Lihat foto asli” untuk membandingkan hasil dengan fotomu.',
        },
        {
          title: '3. Simpan PNG',
          text: 'Unduh gambar transparan, atau klik kanan hasilnya untuk menyalin. Pola kotak-kotak hanya pratinjau area transparan.',
        },
      ],
      questions: 'Sebelum mengunggah',
      faq: [
        {
          question: 'Apakah benar-benar gratis?',
          answer:
            'Ya. Kamu bisa menghapus background dan mengunduh PNG tanpa membuat akun atau membayar. BG Poof tidak menambahkan watermark. Agar layanan tetap tersedia, jumlah permintaan dibatasi; jika mencapai batas, tunggu satu menit lalu coba lagi.',
        },
        {
          question: 'Foto apa saja yang bisa diunggah?',
          answer:
            'File JPG, PNG, dan WebP hingga 25 MB dan 25 megapiksel, dengan sisi terpanjang 8.192 piksel. Gunakan foto paling jelas yang kamu punya. Tepi yang buram dan objek yang menyatu dengan background sulit dipisahkan.',
        },
        {
          question: 'Apakah rambut, kaca, dan benda mengilap tetap terjaga?',
          answer:
            'Tidak selalu. Rambut tipis, kaca bening, foil reflektif, dan bayangan bisa membingungkan penghapusan otomatis. BG Poof merapikan tepi, tetapi tidak selalu bisa mengembalikan bagian besar objek yang terlewat. Baca ',
          link: {
            href: '/background-removal-tips',
            text: 'panduan kualitas foto (bahasa Inggris)',
            after: ' sebelum mencoba lagi.',
          },
        },
        {
          question: 'Ke mana fotoku dikirim?',
          answer:
            'Cloudflare memproses unggahanmu. Server pemrosesan kami juga menerimanya untuk merapikan tepi secara otomatis jika fitur itu aktif. BG Poof tidak menyimpan unggahan atau hasil; browser-mu menyimpan gambar kerja selama halaman dibuka. ',
          link: {
            href: '/about',
            text: 'Baca detail pemrosesan dan privasi (bahasa Inggris).',
          },
        },
      ],
      guides: 'Panduan foto',
      guidesNote: 'Panduan ini tersedia dalam bahasa Inggris.',
    },
    footer: {
      tagline: 'Gratis · Tanpa watermark · Tanpa daftar',
      navigation: 'Bantuan dan informasi',
      languages: 'Bahasa',
      about: 'Tentang & lisensi',
      guides: {
        '/how-to-remove-background': 'Cara menghapus background',
        '/transparent-png': 'Menyimpan PNG transparan',
        '/background-removal-tips': 'Tips hasil potongan lebih baik',
        '/remove-bg-alternative': 'Alternatif remove.bg gratis',
      },
    },
  },
  '/pt-br': {
    remover: {
      home: 'Início do bgpoof',
      headerNote: 'Grátis. Sem cadastro.',
      uploadLabel: 'Enviar foto',
      eyebrow: 'Menos fundo. Mais foto.',
      headingStart: 'Remover fundo',
      headingEnd: 'de imagem grátis.',
      introStart: 'Remova o fundo de qualquer imagem em segundos.',
      introEnd: 'Solte a foto aqui e receba um PNG transparente.',
      upload: 'Enviar imagem',
      drop: 'ou solte uma foto em qualquer lugar',
      paste: 'Você também pode colar com',
      fileHint: 'JPG, PNG, WebP · até 25 MB / 25 MP',
      secure: 'Processado com segurança pela Cloudflare.',
      imageProcessed: 'imagem processada',
      imagesProcessed: 'imagens processadas',
      credit: 'Projeto de',
      demoSection: 'Exemplo de remoção de fundo',
      demoCaption: 'Veja o que desaparece.',
      tryPhoto: 'Testar esta foto',
      demoCompare: 'Exemplo de antes e depois',
      slide: 'Deslize para ver a diferença',
      demoCutoutAlt: 'Recorte de um golden retriever sem o fundo',
      demoOriginalAlt: 'Golden retriever ao ar livre antes da remoção do fundo',
      resultEyebrow: 'SUA FOTO EM PRIMEIRO PLANO',
      removed: 'Fundo removido.',
      working: 'Fazendo o fundo desaparecer…',
      tryAgain: 'Vamos tentar de novo.',
      cancelRemoval: 'Cancelar remoção',
      clearPhoto: 'Remover esta foto',
      photoCompare: 'Sua foto antes e depois',
      finishing: 'Finalizando seu PNG.',
      cutting: 'Fazendo o recorte.',
      progress: 'Progresso da remoção de fundo',
      downloadNote: 'O download aparecerá quando o PNG estiver pronto.',
      cancel: 'Cancelar',
      allYours: 'Prontinho.',
      transparent: 'Fundo transparente.',
      originalSize: 'A resolução original da sua foto.',
      download: 'Baixar PNG',
      fullResolution: 'resolução total',
      showCutout: 'Mostrar recorte',
      showOriginal: 'Mostrar original',
      tryAnother: 'Testar outra foto',
      anotherGo: 'Tente mais uma vez.',
      anotherGoText: 'Você pode escolher outra foto ou tentar esta novamente.',
      retry: 'Tentar novamente',
      chooseAnother: 'Escolher outra foto',
      noAccount: 'Sem cadastro. Sem marca d’água.',
      resultHint:
        'Clique com o botão direito na imagem para copiá-la. Cole ou solte outra foto para continuar.',
      dismissError: 'Fechar erro',
      dropTitle: 'Pode soltar.',
      dropText: 'Solte sua foto para começar.',
      originalLabel: 'Original',
      removedLabel: 'Fundo removido',
      cutoutAlt: 'Sua foto com fundo transparente',
      originalAlt: 'Sua foto original',
      messages: {
        'Preparing your photo…': 'Preparando sua foto…',
        'Removing the background…': 'Removendo o fundo…',
        'Receiving your cutout…': 'Recebendo seu recorte…',
        'Preparing your preview…': 'Preparando a prévia…',
        'Preparing your full-resolution image…':
          'Preparando a imagem em resolução total…',
        'Creating your PNG…': 'Criando seu PNG…',
        'Choose a JPG, PNG, or WebP photo.':
          'Escolha uma foto JPG, PNG ou WebP.',
        'This photo is too large. Choose one smaller than 25 MB.':
          'Esta foto é grande demais. Escolha uma menor que 25 MB.',
        'Choose a photo up to 25 megapixels, with each side under 8,193 pixels.':
          'Escolha uma foto de até 25 megapixels, com cada lado abaixo de 8.193 pixels.',
        'Choose a photo up to 25 megapixels and 8,192 pixels per side.':
          'Escolha uma foto de até 25 megapixels e 8.192 pixels por lado.',
        'We couldn’t read this photo. Try another JPG, PNG, or WebP.':
          'Não conseguimos ler esta foto. Tente outro JPG, PNG ou WebP.',
        'Choose one photo at a time.': 'Escolha uma foto de cada vez.',
        'The example couldn’t load. Upload your own photo to try it.':
          'O exemplo não carregou. Envie sua própria foto para testar.',
        'The example couldn’t load.': 'O exemplo não carregou.',
        'Your browser couldn’t prepare this photo.':
          'Seu navegador não conseguiu preparar esta foto.',
        'This photo is too detailed. Try a smaller photo.':
          'Esta foto tem detalhes demais. Tente uma foto menor.',
        'The background remover couldn’t finish. Please try again.':
          'A remoção de fundo não terminou. Tente novamente.',
        'The background remover returned an invalid result. Please try again.':
          'A remoção de fundo retornou um resultado inválido. Tente novamente.',
        'The background remover returned an invalid size. Please try again.':
          'A remoção de fundo retornou um tamanho inválido. Tente novamente.',
        'Your browser couldn’t save this photo. Try a smaller photo.':
          'Seu navegador não conseguiu salvar esta foto. Tente uma foto menor.',
        'The background remover is taking longer than usual. Please try again.':
          'A remoção de fundo está demorando mais que o normal. Tente novamente.',
        'We couldn’t reach the background remover. Check your connection and try again.':
          'Não conseguimos acessar o serviço. Verifique sua conexão e tente novamente.',
        'Your browser can’t run the background remover. Try a current version of Chrome, Safari, Firefox, or Edge.':
          'Seu navegador não executa esta ferramenta. Tente uma versão atual do Chrome, Safari, Firefox ou Edge.',
        'This photo is taking longer than usual. Check your connection and try again.':
          'Esta foto está demorando mais que o normal. Verifique sua conexão e tente novamente.',
        'The background remover couldn’t start. Check your connection, close other tabs, and try again.':
          'A ferramenta não conseguiu iniciar. Verifique sua conexão, feche outras abas e tente novamente.',
        'Background removal is temporarily unavailable. Please try again shortly.':
          'A remoção de fundo está temporariamente indisponível. Tente novamente em instantes.',
        'This image could not be read. Try another JPEG, PNG, or WebP image.':
          'Não foi possível ler esta imagem. Tente outra em JPEG, PNG ou WebP.',
        'Too many uploads. Please wait a minute and try again.':
          'Muitos envios. Aguarde um minuto e tente novamente.',
        'The image upload was interrupted. Please try again.':
          'O envio da imagem foi interrompido. Tente novamente.',
        'We couldn’t verify this browser. Refresh the page and try again.':
          'Não conseguimos verificar este navegador. Atualize a página e tente novamente.',
      },
    },
    help: {
      heading: 'Remova o fundo de imagens online, grátis e sem cadastro',
      intro:
        'Precisa tirar o fundo de uma foto para um anúncio, foto de perfil ou design? Esta ferramenta gratuita gera um PNG transparente nas dimensões originais da sua foto, sem marca d’água e sem plano pago para baixar.',
      steps: [
        {
          title: '1. Adicione sua foto',
          text: 'Envie um JPG, PNG ou WebP. Você também pode soltar um arquivo em qualquer lugar desta página ou colar uma imagem da área de transferência.',
        },
        {
          title: '2. Confira o recorte',
          text: 'A remoção do fundo começa automaticamente. Quando terminar, use “Mostrar original” para comparar o resultado com sua foto.',
        },
        {
          title: '3. Salve o PNG',
          text: 'Baixe a imagem transparente ou clique com o botão direito no recorte para copiá-lo. O quadriculado é apenas uma prévia da área transparente.',
        },
      ],
      questions: 'Antes de enviar',
      faq: [
        {
          question: 'É grátis mesmo?',
          answer:
            'Sim. Você pode remover o fundo e baixar o PNG sem criar conta nem pagar. O BG Poof não adiciona marca d’água. Para manter o serviço disponível, os pedidos têm limite de frequência; se atingir o limite, aguarde um minuto e tente novamente.',
        },
        {
          question: 'Quais fotos posso enviar?',
          answer:
            'Arquivos JPG, PNG e WebP de até 25 MB e 25 megapixels, sem nenhum lado maior que 8.192 pixels. Use o original mais nítido que tiver. Bordas borradas e objetos que se misturam ao fundo são difíceis de separar.',
        },
        {
          question: 'Cabelo, vidro e objetos brilhantes são preservados?',
          answer:
            'Nem sempre. Cabelos finos, vidro transparente, papel-alumínio e sombras podem confundir a remoção automática. O BG Poof refina as bordas, mas não recupera com segurança uma parte grande do objeto que tenha sido perdida. Leia o ',
          link: {
            href: '/background-removal-tips',
            text: 'guia de qualidade da foto (em inglês)',
            after: ' antes de tentar novamente.',
          },
        },
        {
          question: 'Para onde vai minha foto?',
          answer:
            'A Cloudflare processa seu envio. Nosso servidor de processamento também o recebe para refinar as bordas automaticamente quando esse recurso está ativo. O BG Poof não salva envios nem resultados; seu navegador mantém as imagens de trabalho enquanto você usa a página. ',
          link: {
            href: '/about',
            text: 'Leia os detalhes de processamento e privacidade (em inglês).',
          },
        },
      ],
      guides: 'Guias de fotos',
      guidesNote: 'Estes guias estão em inglês.',
    },
    footer: {
      tagline: 'Grátis · Sem marca d’água · Sem cadastro',
      navigation: 'Ajuda e informações',
      languages: 'Idioma',
      about: 'Sobre e licenças',
      guides: {
        '/how-to-remove-background': 'Como remover o fundo',
        '/transparent-png': 'Como salvar um PNG transparente',
        '/background-removal-tips': 'Como conseguir um recorte melhor',
        '/remove-bg-alternative': 'Uma alternativa grátis ao remove.bg',
      },
    },
  },
  '/es': {
    remover: {
      home: 'Inicio de bgpoof',
      headerNote: 'Gratis. Sin registro.',
      uploadLabel: 'Subir foto',
      eyebrow: 'Menos fondo. Más foto.',
      headingStart: 'Quitar fondo',
      headingEnd: 'de imagen gratis.',
      introStart: 'Quita el fondo de cualquier imagen en segundos.',
      introEnd: 'Suelta la foto y obtén un PNG transparente.',
      upload: 'Subir imagen',
      drop: 'o suelta una foto en cualquier lugar',
      paste: 'También puedes pegarla con',
      fileHint: 'JPG, PNG, WebP · hasta 25 MB / 25 MP',
      secure: 'Procesado de forma segura por Cloudflare.',
      imageProcessed: 'imagen procesada',
      imagesProcessed: 'imágenes procesadas',
      credit: 'Proyecto de',
      demoSection: 'Ejemplo de eliminación de fondo',
      demoCaption: 'Mira lo que desaparece.',
      tryPhoto: 'Probar esta foto',
      demoCompare: 'Ejemplo de antes y después',
      slide: 'Desliza para ver la diferencia',
      demoCutoutAlt: 'Recorte de un golden retriever sin el fondo',
      demoOriginalAlt:
        'Golden retriever al aire libre antes de quitar el fondo',
      resultEyebrow: 'TU FOTO EN PRIMER PLANO',
      removed: 'Fondo eliminado.',
      working: 'Haciendo desaparecer el fondo…',
      tryAgain: 'Intentémoslo de nuevo.',
      cancelRemoval: 'Cancelar eliminación',
      clearPhoto: 'Quitar esta foto',
      photoCompare: 'Tu foto antes y después',
      finishing: 'Terminando tu PNG.',
      cutting: 'Haciendo el recorte.',
      progress: 'Progreso de la eliminación del fondo',
      downloadNote: 'La descarga aparecerá cuando el PNG esté listo.',
      cancel: 'Cancelar',
      allYours: 'Todo listo.',
      transparent: 'Fondo transparente.',
      originalSize: 'La resolución original de tu foto.',
      download: 'Descargar PNG',
      fullResolution: 'resolución completa',
      showCutout: 'Ver recorte',
      showOriginal: 'Ver original',
      tryAnother: 'Probar otra foto',
      anotherGo: 'Inténtalo otra vez.',
      anotherGoText: 'Puedes elegir otra foto o volver a intentar con esta.',
      retry: 'Reintentar',
      chooseAnother: 'Elegir otra foto',
      noAccount: 'Sin registro. Sin marca de agua.',
      resultHint:
        'Haz clic derecho en la imagen para copiarla. Pega o suelta otra foto para continuar.',
      dismissError: 'Cerrar error',
      dropTitle: 'Suéltala aquí.',
      dropText: 'Suelta tu foto para empezar.',
      originalLabel: 'Original',
      removedLabel: 'Fondo eliminado',
      cutoutAlt: 'Tu foto con fondo transparente',
      originalAlt: 'Tu foto original',
      messages: {
        'Preparing your photo…': 'Preparando tu foto…',
        'Removing the background…': 'Quitando el fondo…',
        'Receiving your cutout…': 'Recibiendo tu recorte…',
        'Preparing your preview…': 'Preparando la vista previa…',
        'Preparing your full-resolution image…':
          'Preparando la imagen a resolución completa…',
        'Creating your PNG…': 'Creando tu PNG…',
        'Choose a JPG, PNG, or WebP photo.': 'Elige una foto JPG, PNG o WebP.',
        'This photo is too large. Choose one smaller than 25 MB.':
          'Esta foto es demasiado grande. Elige una de menos de 25 MB.',
        'Choose a photo up to 25 megapixels, with each side under 8,193 pixels.':
          'Elige una foto de hasta 25 megapíxeles, con cada lado por debajo de 8.193 píxeles.',
        'Choose a photo up to 25 megapixels and 8,192 pixels per side.':
          'Elige una foto de hasta 25 megapíxeles y 8.192 píxeles por lado.',
        'We couldn’t read this photo. Try another JPG, PNG, or WebP.':
          'No pudimos leer esta foto. Prueba con otro JPG, PNG o WebP.',
        'Choose one photo at a time.': 'Elige una foto cada vez.',
        'The example couldn’t load. Upload your own photo to try it.':
          'El ejemplo no se pudo cargar. Sube tu propia foto para probar.',
        'The example couldn’t load.': 'El ejemplo no se pudo cargar.',
        'Your browser couldn’t prepare this photo.':
          'Tu navegador no pudo preparar esta foto.',
        'This photo is too detailed. Try a smaller photo.':
          'Esta foto tiene demasiado detalle. Prueba con una foto más pequeña.',
        'The background remover couldn’t finish. Please try again.':
          'No se pudo terminar de quitar el fondo. Inténtalo de nuevo.',
        'The background remover returned an invalid result. Please try again.':
          'El resultado no es válido. Inténtalo de nuevo.',
        'The background remover returned an invalid size. Please try again.':
          'El tamaño del resultado no es válido. Inténtalo de nuevo.',
        'Your browser couldn’t save this photo. Try a smaller photo.':
          'Tu navegador no pudo guardar esta foto. Prueba con una foto más pequeña.',
        'The background remover is taking longer than usual. Please try again.':
          'Está tardando más de lo normal. Inténtalo de nuevo.',
        'We couldn’t reach the background remover. Check your connection and try again.':
          'No pudimos conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.',
        'Your browser can’t run the background remover. Try a current version of Chrome, Safari, Firefox, or Edge.':
          'Tu navegador no puede ejecutar esta herramienta. Prueba con una versión actual de Chrome, Safari, Firefox o Edge.',
        'This photo is taking longer than usual. Check your connection and try again.':
          'Esta foto está tardando más de lo normal. Revisa tu conexión e inténtalo de nuevo.',
        'The background remover couldn’t start. Check your connection, close other tabs, and try again.':
          'La herramienta no pudo iniciarse. Revisa tu conexión, cierra otras pestañas e inténtalo de nuevo.',
        'Background removal is temporarily unavailable. Please try again shortly.':
          'La eliminación de fondos no está disponible por el momento. Inténtalo de nuevo en breve.',
        'This image could not be read. Try another JPEG, PNG, or WebP image.':
          'No se pudo leer esta imagen. Prueba con otra en JPEG, PNG o WebP.',
        'Too many uploads. Please wait a minute and try again.':
          'Demasiadas subidas. Espera un minuto e inténtalo de nuevo.',
        'The image upload was interrupted. Please try again.':
          'La subida de la imagen se interrumpió. Inténtalo de nuevo.',
        'We couldn’t verify this browser. Refresh the page and try again.':
          'No pudimos verificar este navegador. Actualiza la página e inténtalo de nuevo.',
      },
    },
    help: {
      heading: 'Elimina el fondo de una imagen online, gratis y sin registro',
      intro:
        '¿Necesitas quitar el fondo de una foto para un anuncio, una foto de perfil o un diseño? Esta herramienta gratuita crea un PNG transparente con las dimensiones originales de tu foto, sin marca de agua ni planes de pago para descargar.',
      steps: [
        {
          title: '1. Añade tu foto',
          text: 'Sube un JPG, PNG o WebP. También puedes soltar un archivo en cualquier lugar de esta página o pegar una imagen desde el portapapeles.',
        },
        {
          title: '2. Revisa el recorte',
          text: 'El fondo se elimina automáticamente. Cuando termine, usa “Ver original” para comparar el resultado con tu foto.',
        },
        {
          title: '3. Guarda el PNG',
          text: 'Descarga la imagen transparente o haz clic derecho en el recorte para copiarlo. El patrón de cuadros es solo una vista previa de la zona transparente.',
        },
      ],
      questions: 'Antes de subir tu foto',
      faq: [
        {
          question: '¿De verdad es gratis?',
          answer:
            'Sí. Puedes quitar el fondo y descargar el PNG sin crear una cuenta ni pagar. BG Poof no añade marca de agua. Para mantener el servicio disponible, las solicitudes tienen un límite; si lo alcanzas, espera un minuto e inténtalo de nuevo.',
        },
        {
          question: '¿Qué fotos puedo subir?',
          answer:
            'Archivos JPG, PNG y WebP de hasta 25 MB y 25 megapíxeles, sin ningún lado mayor de 8.192 píxeles. Usa el original más nítido que tengas. Los bordes borrosos y los objetos que se confunden con el fondo son difíciles de separar.',
        },
        {
          question: '¿Conserva el pelo, el vidrio y los objetos brillantes?',
          answer:
            'No siempre. El pelo fino, el vidrio transparente, el papel de aluminio y las sombras pueden confundir la eliminación automática. BG Poof refina los bordes, pero no puede recuperar con fiabilidad una parte grande del objeto que se haya perdido. Lee la ',
          link: {
            href: '/background-removal-tips',
            text: 'guía de calidad de foto (en inglés)',
            after: ' antes de volver a intentarlo.',
          },
        },
        {
          question: '¿A dónde va mi foto?',
          answer:
            'Cloudflare procesa tu subida. Nuestro servidor de procesamiento también la recibe para refinar los bordes automáticamente cuando esa función está activa. BG Poof no guarda subidas ni resultados; tu navegador conserva las imágenes de trabajo mientras usas la página. ',
          link: {
            href: '/about',
            text: 'Lee los detalles de procesamiento y privacidad (en inglés).',
          },
        },
      ],
      guides: 'Guías de fotos',
      guidesNote: 'Estas guías están en inglés.',
    },
    footer: {
      tagline: 'Gratis · Sin marca de agua · Sin registro',
      navigation: 'Ayuda e información',
      languages: 'Idioma',
      about: 'Acerca de y licencias',
      guides: {
        '/how-to-remove-background': 'Cómo quitar un fondo',
        '/transparent-png': 'Cómo guardar un PNG transparente',
        '/background-removal-tips': 'Cómo conseguir un mejor recorte',
        '/remove-bg-alternative': 'Una alternativa gratis a remove.bg',
      },
    },
  },
};
