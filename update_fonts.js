import fs from 'fs';

const ttfUrls = {
  inter: {
    regular: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrj72A.ttf',
    bold: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrj72A.ttf',
    italic: 'https://fonts.gstatic.com/s/inter/v20/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dthjZ-Ck-8.ttf',
    boldItalic: 'https://fonts.gstatic.com/s/inter/v20/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTcPtxhjZ-Ck-8.ttf'
  },
  roboto: {
    regular: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmTgg3Wlg.ttf',
    bold: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammTgg3Wlg.ttf',
    italic: 'https://fonts.gstatic.com/s/roboto/v51/KFOKCnqEu92Fr1Mu53ZEC9_Vu3r1gIhOszmOClHrs6ljXfMMLoHQiA_0lFQm.ttf',
    boldItalic: 'https://fonts.gstatic.com/s/roboto/v51/KFOKCnqEu92Fr1Mu53ZEC9_Vu3r1gIhOszmOClHrs6ljXfMMLmbXiA_0lFQm.ttf'
  },
  openSans: {
    regular: 'https://fonts.gstatic.com/s/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0C4nY1U2xQ.ttf',
    bold: 'https://fonts.gstatic.com/s/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsg-1y4nY1U2xQ.ttf',
    italic: 'https://fonts.gstatic.com/s/opensans/v44/memQYaGs126MiZpBA-UFUIcVXSCEkx2cmqvXlWq8tWZ0Pw86hd0Rk8ZkaVcUx6EQ.ttf',
    boldItalic: 'https://fonts.gstatic.com/s/opensans/v44/memQYaGs126MiZpBA-UFUIcVXSCEkx2cmqvXlWq8tWZ0Pw86hd0RkyFjaVcUx6EQ.ttf'
  },
  montserrat: {
    regular: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-Y31cow.ttf',
    bold: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-Y31cow.ttf',
    italic: 'https://fonts.gstatic.com/s/montserrat/v31/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq6R9aX9-obK4.ttf',
    boldItalic: 'https://fonts.gstatic.com/s/montserrat/v31/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq0N6aX9-obK4.ttf'
  },
  lato: {
    regular: 'https://fonts.gstatic.com/s/lato/v25/S6uyw4BMUTPHvxk6WQev.ttf',
    bold: 'https://fonts.gstatic.com/s/lato/v25/S6u9w4BMUTPHh6UVew-FHi_o.ttf',
    italic: 'https://fonts.gstatic.com/s/lato/v25/S6u8w4BMUTPHjxswWyWtFCc.ttf',
    boldItalic: 'https://fonts.gstatic.com/s/lato/v25/S6u_w4BMUTPHjxsI5wqPHA3q5d0.ttf'
  },
  liberationSans: {
    regular: '/fonts/arimo-regular.ttf',
    bold: '/fonts/arimo-bold.ttf',
    italic: '/fonts/arimo-italic.ttf',
    boldItalic: '/fonts/arimo-bold-italic.ttf'
  }
};

const path = 'src/engine/font-registry.ts';
let code = fs.readFileSync(path, 'utf8');

for (const [font, variants] of Object.entries(ttfUrls)) {
  for (const [variant, url] of Object.entries(variants)) {
    const regex = new RegExp(`${variant}:\\s*['"][^'"]+\\.(woff2|woff)['"]`, 'g');
    code = code.replace(regex, `${variant}: '${url}'`);
  }
}

fs.writeFileSync(path, code);
console.log("Updated!");
