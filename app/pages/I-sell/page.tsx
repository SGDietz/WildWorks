import AspectRatioImage from "../../components/AspectRatioImage";
import SubpageCallCta from "../../components/SubpageCallCta";
import SubpageIScottCta from "../../components/SubpageIScottCta";

export default function ISell() {
    return (
        <div className="wild-subpage wild-subpage--sell mx-auto lg:max-w-5xl py-4 discordSection discordSection--1">
            <section className="wild-subpage-hero relative flex w-full items-center justify-center overflow-hidden px-4 sm:px-6">
                <AspectRatioImage
                    src="/TravisGabby-20260731.png"
                    alt="Scott sitting in a WildWorks boulder garden with perennial flowers"
                    className="wild-sell-hero-image object-contain object-center"
                    priority
                    sizes="100vw"
                    lightboxTitle="WildWorks Art and Problem Solving"
                />
            </section>

            <section className="wild-subpage-section wild-subpage-contact discordSection discordSection--2 mx-auto w-full px-4 pt-6 text-white sm:px-6 sm:pt-8" >
                <h1 className="mb-2 text-2xl sm:text-3xl">
                My Work Sells People&apos;s Homes. Period.
                </h1>
                <div className="wild-sell-copy space-y-2 text-left text-sm leading-relaxed">
                    <p className="text-base">
                        I Don&apos;t Work in Real Estate, But Over the Years—Now More Than Forty of Them—I&apos;ve Lost
                        Count of How Many Clients Have Said the Exact Same Thing to Me: &quot;Scott—You Sold Our House.&quot;
                    </p>
                    <h2 className="wild-sell-break-heading">&quot;You Sold Our House.&quot;</h2>
                    <p className="text-base">
                        Last Summer, I Was Standing in the Front Yard of a Client&apos;s Property After They Had Sold Their Old Home, and Called Me in to Fix Up Their New One. The Homeowner Looked at Me and He Was Absolutely Glowing. I Didn&apos;t Ask Him, and He Didn&apos;t Tell Me, But I Knew Just By the Look on His Face That They Had Gotten a Great Price for Their Old Home.
                    </p>
                    <p className="text-base">
                    He Said to Me: &quot;You Sold Our House. It Had to Be You. You Gave Us the Most Beautiful Things There!&quot; He Also Said, &quot;You&apos;re the Best! You Are Absolutely the Best There is. You&apos;re Going to Make Our New House Spectacular!&quot; This is the House That Two 70 Year Olds with 20 Grandkids Are Going to Spend Their Golden Years. They Believed in Me, That I Delivered <em>Spectacular</em>.
                    </p>
                    <p className="text-base">
                        Another Client Told Me the Same Thing After Reading Their Realtor&apos;s Report. The Buyers Specifically Mentioned How Much They Loved the Super Artsy and Wild Patio and Seat Wall Area. That Outdoor Space Was the Reason They Fell in Love with the Home, and Had to Have It.
                    </p>
                    <p className="text-base">
                        Another Family, with Two Kids Under Three Years Old, Wanted a Practical Back Yard That Was Safe to Walk and Play on. Their Backyard Was an 80 Year Old Mess of Highs, Lows, and Mysterious Holes. We Reshaped and Fine Graded the Entire Space, and Added a Patio, Firepit, and Walkways That Made the Yard Usable and Practical. When We Were Finished, I Said That I Believed We Had Added at Least the Value of What They Paid for the Project Back Into Their Home.
                    </p>
                    <p className="text-base">
                    They Both Nodded Vociferously and the Wife Said, “Oh My God—at Least!”
                    </p>
                    <h2 className="wild-sell-break-heading">Not Workarounds. Not Patches.</h2>
                    <p className="text-base">
                        That Kind of Result Doesn&apos;t Happen By Accident. It Comes from Fixing Problems Correctly—and at a Fair Price. The Best Part of All? You, the Client, Get to Enjoy These Things as Long as You Own Your Home. For These Clients, They Had Not Only the Dream Back Yard for Their Kids to Grow Up in, the Congregating Area Their Family Could Enjoy for Decades, and Also an Investment That Was Going to Give Them Maximum Return on Investment.
                    </p>
                    <p className="text-base">
                        I&apos;ve Always Been Drawn to Not Only Beauty, But Practicality and Problem Solving. I Charge Forward Into the Hardest Problems—the Ones People Live with for Years Because No One Can Quite Figure Them Out. The Spaces That Never Worked. The Water Issues No One Could Stop. I&apos;ve Solved Home and Garden Problems for Clients Who Had Been Searching—Sometimes for Decades—for Real Solutions. Not Workarounds. Not Patches. Solutions That Make Sense, Last, and Actually Improve People&apos;s Quality of Life.
                    </p>
                    <h2 className="wild-sell-break-heading">Real Return on Investment.</h2>
                    <p className="text-base">
                        At the End of the Day, Solving Problems the Right Way Creates Real Return on Investment—Sometimes in Day-to-Day Livability, Sometimes in Resale Value, and Often in Both. Whether You Need a Purely Practical Solution to Something That Isn&apos;t Working, or You&apos;re Looking for an Exquisitely Beautiful Piece of Art, My Approach is the Same: Fair Pricing, Quality Building, and Work That Gives You the Highest Return on Investment.
                    </p>
                    <h2 className="wild-sell-break-heading">If You&apos;d Like to Talk It Through</h2>
                    <p className="text-base">
                    If You&apos;d Like to Talk It Through, I&apos;m Happy to Drive to You or Hop on a Video Call—Whether You&apos;re Not Far Away or Halfway Around the World—and Help Figure Out What Will Actually Make the Most Sense for You, Your Family, and Your Home. Please Feel Free to Call Now—I&apos;m Always Happy to Talk.
                    </p>
                    <SubpageIScottCta />
                    <SubpageCallCta />
                    <h1 className="wild-sell-signature text-center mb-6 sm:mb-12">Scott.</h1>
                </div>
            </section>
        </div>
    )
}
