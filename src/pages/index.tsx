import { type NextPage } from "next";
import Head from "next/head";
import { InteractiveArea } from "~/components/interactive-area";

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>FreeOTP Dump</title>
        <meta
          name="description"
          content="Easily export your FreeOTP keys for use in another app"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="p-4 text-3xl font-bold">FreeOTP Dump</h1>
        <InteractiveArea />
        <footer className="p-4">
          A tool created by
          <a
            href="https://github.com/lukas-schaffer"
            className="text-emerald-600"
          >
            {" "}
            Zirruedo{" "}
          </a>
          and
          <a href="https://toast.ws" className="text-emerald-600">
            {" "}
            kathrindc{" "}
          </a>
          .
        </footer>
      </main>
    </>
  );
};

export default Home;
